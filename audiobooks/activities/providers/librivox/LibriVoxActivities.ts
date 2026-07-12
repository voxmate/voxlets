import {Rolodex, RolodexOptions} from "@voxmate/orc/rolodex";
import voxmate, {Actor, Sound} from "@voxmate/voxmate";
import {BookShelf, BookShelfManager, IBookShelfBook} from "../../../BookShelf";
import {AudiobookMultiTrackPlayerActivity, IMultiTrackBook, SLEEP_TIMER_DURATIONS} from "../../common/TrackPlayer";
import {RollActivity} from "@voxmate/orc/RollActivity";

import cheerio from "cheerio";
import * as _ from "lodash";

import {BasePlayer} from "@voxmate/orc/player";
import {About} from "../../common/About";
import {arrayToText} from "@voxmate/voxmate/utility/array";

import about from "./about.json";

const LibriVoxProviderKey = "LIBRIVOX";
const ROOT_URL = "https://librivox.org/";

// UTIL
const bracketText = /\(.+\)/gm;
const unknownAuthor = "Unknown Author";
const unknownReaders = "Various Readers";


interface ILibriVoxBookDescriptor {
    title: string;
    author: string;
    url: string;
    isEnglish: boolean;
}

interface ILibriVoxBookDetail {
    trackUrls: string[];
    trackNames: string[];
    synopsis: string[];
    readers: string[];
}

interface ILibriVoxBook extends IMultiTrackBook, IBookShelfBook, ILibriVoxBookDescriptor, ILibriVoxBookDetail {

}

interface ILibriVoxCategory {
    name: string;
    subs: ILibriVoxCategory[];
    id?: number;
}

interface ICategoryBase {
    id: number;
    name: string;
}

interface IUrlBuilder {
    (pageNumber: number): string;
}

interface ISearchPageData {
    pagesCount: number;
    books: ILibriVoxBookDescriptor[];
}

interface ISearchResult {
    builder: IUrlBuilder;
    pagesCount: number;
    pageData: ISearchPageData[];
    pageBookCount: number;
    totalBooks: number;
}

function splitAt(str: string, index: number): [string, string] {
    return [str.slice(0, index).trim(), str.slice(index + 1).trim()];
}

function groupCategories(bases: ICategoryBase[]): ILibriVoxCategory[] {

    const catGroups: { [name: string]: ICategoryBase[] } = {};
    for (let bp of bases) {

        if (bp.id === 0)
            continue;

        const splitIndex = bp.name.indexOf(">");
        let [major, minor] = [bp.name, bp.name];

        if (splitIndex !== -1)
            [major, minor] = splitAt(bp.name, splitIndex);

        const group = catGroups[major] || [];
        catGroups[major] = group;

        group.push({
            id: bp.id,
            name: minor
        });
    }

    const categories: ILibriVoxCategory[] = [];
    for (let groupName in catGroups) {
        const items = catGroups[groupName] as ICategoryBase[];
        if (items.length === 1) {
            categories.push({
                name: groupName,
                subs: [],
                id: items[0].id
            });
        } else {

            for (let item of items) {
                if (item.name === groupName) {
                    item.name = "All in " + groupName;
                }
            }

            categories.push({
                subs: groupCategories(items),
                name: groupName
            });
        }
    }

    return categories;
}

function extractCategories(html: string): ILibriVoxCategory[] {

    function fixCategoryName(name: string): string {
        name = name.trim();
        if (name.startsWith("*"))
            return name.substr(1);
        return name;
    }

    const $ = cheerio.load(html);

    const options = $("#genre_id").find("option").get();
    const bases: ICategoryBase[] = [];
    for (let option of options) {
        const od = $(option);

        const categoryId = parseInt(od.attr("value"));
        const categoryName = fixCategoryName(od.text());
        bases.push({id: categoryId, name: categoryName});
    }

    const sortedBases = _.sortBy(bases, (b) => b.name);
    return groupCategories(sortedBases);
}

function fixAuthorNamePart(part: string) {
    if (part.endsWith("."))
        part = part.substr(0, part.length - 1);


    if (part.length === 0)
        return "";

    part = part.toLowerCase();
    return part[0].toUpperCase() + part.slice(1);
}

function fixPersonsName(author: string) {

    if (author === "n/a")
        return unknownAuthor;

    author = author.replace(bracketText, "").trim();
    return author.split(" ").map(p => fixAuthorNamePart(p)).join(" ");
}

function fixTitle(title: string) {
    title = title.replace(bracketText, "");
    return title.trim();
}

function fixSectionName(name: string) {
    //Remove Chapter-1 like names from chapters
    name = name.replace(/chapter \d+/gmi, "").trim();

    //Remove dangling dashes and the like
    name = name.replace(/^\W+/gmi, "").trim();

    return name;
}

function processPageData(data: string, pagination: string): ISearchPageData {

    let lastPageNumber = 1;
    if (pagination.length > 0) {
        const p$ = cheerio.load(pagination);
        lastPageNumber = parseInt(p$(".page-number.last").attr("data-page_number"));
    }

    const $ = cheerio.load(data);

    const books: ILibriVoxBookDescriptor[] = [];
    for (let result of $(".catalog-result").get()) {
        const $$ = $(result);

        const aTag = $($$.find(".result-data > h3 > a").get(0));
        const title = fixTitle(aTag.text());
        const url = aTag.attr("href");

        const author = fixPersonsName($$.find(".book-author").text().trim());
        const meta = $$.find(".book-meta").text().trim().toLowerCase();

        if (meta.includes("complete"))
            books.push({
                author: author,
                title: title,
                url: url,
                isEnglish: meta.includes("english")
            });
    }

    return {
        pagesCount: lastPageNumber,
        books: books
    };
}

function extractTrackContent(html: string): ILibriVoxBookDetail {

    const $ = cheerio.load(html);
    const content = $(".page.book-page");
    const synopsis = content.find(".description").text().trim();

    const trackUrls = [];
    const trackNames = [];

    const chapters = content.find(".chapter-download tbody").find(".chapter-name");
    for (let chapter of chapters.get()) {
        trackUrls.push($(chapter).attr("href"));
        trackNames.push(fixSectionName($(chapter).text().trim()));
    }

    const readerMap = {};
    const allUrls = content.find(".chapter-download tbody a");
    for (let url of allUrls.get()) {
        const cUrl = $(url);
        if (cUrl.attr("href").indexOf("/reader/") !== -1)
            readerMap[cUrl.text().trim()] = true;
    }

    const readers = Object.keys(readerMap);
    if (readers.length === 0)
        readers.push(unknownReaders);

    return {
        synopsis: voxmate.utility.splitIntoSentences(synopsis),
        trackUrls: trackUrls,
        trackNames: trackNames,
        readers: readers.map(r => fixPersonsName(r))
    };
}

function formatSection(book: ILibriVoxBook, trackIndex) {
    const trackName = book.trackNames[trackIndex];
    let sectionString = `Section ${trackIndex + 1} of ${(book.trackCount)}`;
    if (trackName.length)
        sectionString += ` - ${trackName}`;
    return sectionString;
}

function formatBook(book: ILibriVoxBookDescriptor) {
    if (book.author === unknownAuthor)
        return book.title;
    return `${book.title} by ${book.author}`;
}

function chooseSampleTrack(book: ILibriVoxBook): string {
    let url = book.trackUrls[0];
    if (book.trackUrls.length > 3)
        url = book.trackUrls[3];
    return url;
}

class LibriVoxPreviewPlayerActivity extends BasePlayer {

    constructor(private readonly resourceId: string) {
        super();
    }

    protected getPlayerResourceId(): string {
        return this.resourceId;
    }
}

class LibriVoxMultiTrackPlayer extends AudiobookMultiTrackPlayerActivity<ILibriVoxBook> {

    getTrackNoun(): string {
        return "Section";
    }

    getTrackDescriptor(book: ILibriVoxBook, trackIndex): string {
        return formatSection(book, trackIndex);
    }

    async getTrackResourceId(book: ILibriVoxBook, trackIndex: number): Promise<string> {
        return book.trackUrls[trackIndex];
    }
}

class LibrivoxError {

}

abstract class LibriVoxActivityBase extends RollActivity {

    private get bookshelf(): BookShelf<ILibriVoxBook> {
        return this[BookShelf.inject];
    }

    get shelf(): BookShelfManager<ILibriVoxBook> {
        return new BookShelfManager<ILibriVoxBook>(LibriVoxProviderKey, this.bookshelf);
    }

    private async loadSearchResponse(url: string): Promise<[string, string]> {
        const data = await this.httpGet(url, {"X-Requested-With": "XMLHttpRequest"});
        if (data.isValidJson) {
            const response = JSON.parse(data.content) as { results: string, pagination: string };
            return [response.results, response.pagination];
        } else {
            console.log("DATA", data.content);
            voxmate.system.telemetry.error(`Unable to get books from ${url}`);
        }
        throw new LibrivoxError();
    }

    async loadSearchResultPage(search: ISearchResult, page: number): Promise<ISearchPageData> {
        if (!search.pageData[page - 1]) {
            const [data, pagination] = await this.loadSearchResponse(search.builder(page));
            search.pageData[page - 1] = processPageData(data, pagination);
        }
        return search.pageData[page - 1];
    }

    async getBookByIndex(search: ISearchResult, bookIdx: number): Promise<ILibriVoxBookDescriptor | undefined> {
        const searchResultPage = Math.floor(bookIdx / search.pageBookCount) + 1;
        const page = await this.loadSearchResultPage(search, searchResultPage);
        const offset = bookIdx % search.pageBookCount;
        const book = page.books[offset];
        if (!book) {
            voxmate.system.telemetry.error(`Unable to get book by index: ${bookIdx}`);
            return undefined;
        }

        return book;
    }

    async initSearchResult(builder: IUrlBuilder): Promise<ISearchResult> {
        const [data, pagination] = await this.loadSearchResponse(builder(1));
        const pageData = processPageData(data, pagination);

        const [dataLast, paginationLast] = await this.loadSearchResponse(builder(pageData.pagesCount));
        const lastPageData = processPageData(dataLast, paginationLast);

        const pageBookCount = pageData.books.length;
        const totalBooks = pageBookCount * (pageData.pagesCount - 1) + lastPageData.books.length;

        const pageDataArray = Array(pageData.pagesCount).fill(null);

        pageDataArray[0] = pageData;
        pageDataArray[pageData.pagesCount - 1] = lastPageData;

        return {
            builder: builder,
            pageData: pageDataArray,
            pagesCount: pageData.pagesCount,
            pageBookCount: pageData.books.length,
            totalBooks: totalBooks,
        };
    }

    async initBook(descriptor: ILibriVoxBookDescriptor): Promise<ILibriVoxBook> {

        const data = await this.httpGet(descriptor.url);
        const detail = extractTrackContent(data.content);

        return {
            bookId: descriptor.url,
            trackCount: detail.trackUrls.length,
            trackComplete: Array(detail.trackUrls.length).fill(false),
            lastListenedTimestamp: 0,
            playbackSpeed: 1,
            currentTrackPosition: 0,
            ...detail,
            ...descriptor
        };
    }

}

class LibriVoxBookDescriptorPreview extends LibriVoxActivityBase {

    private book: ILibriVoxBook;

    constructor(private readonly descriptor: ILibriVoxBookDescriptor) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        this.book = await this.initBook(this.descriptor);
    }

    protected async run() {
        const dex = this.roll().setActor(Actor.DynamicInformational);
        dex.add("Play Sample", async () => {
            const sample = chooseSampleTrack(this.book);
            await this.exec(new LibriVoxPreviewPlayerActivity(sample));
        });

        dex.add("Synopsis", async () => {
            const synopsisDex = this.roll();
            for (let line of this.book.synopsis) {
                synopsisDex.add(line);
            }
            await synopsisDex.run({autoskip: true});
        });

        dex.add("Details", async () => {
            const readers = arrayToText(this.book.readers);
            await this.roll(
                `Written by: ${this.book.author}`,
                `Read by: ${readers}`,
                `Consists of: ${this.book.trackCount} Sections`
            ).run({autoskip: true});
        });

        dex.add("Add to my Bookshelf", async () => {
            if (this.shelf.checkBook(this.book.bookId)) {
                await this.sayDynamicContent("Already on your bookshelf.");
            } else {
                this.shelf.add(this.book);
                this.sound(Sound.Good);
            }
        });
        await dex.run();
    }
}

class LibriVoxSearchResultBrowser extends LibriVoxActivityBase {

    private search: ISearchResult;

    constructor(private readonly searchTask: Promise<ISearchResult>) {
        super({
            loadingErrorPrompt: "Librivox server encountered an error, please try again later"
        });
    }

    protected async init(): Promise<void> {
        await super.init();
        this.search = await this.searchTask;
    }

    async run(): Promise<RolodexOptions> {
        const dex = this.roll();

        if (this.search.totalBooks === 0) {
            await this.sayDynamicInfo("I'm sorry, but I couldn't find anything.");
            return;
        }

        for (let i = 0; i < this.search.totalBooks; ++i) {
            dex.add(async () => {
                const book = await this.freeze(this.getBookByIndex(this.search, i));
                await this.sayDynamicContent(formatBook(book));
                await dex.paginate(i, this.search.totalBooks);
            }, async () => {
                const book = await this.getBookByIndex(this.search, i);
                await this.exec(new LibriVoxBookDescriptorPreview(book));
            }).showWhen(async () => {
                const book = await this.freeze(this.getBookByIndex(this.search, i));
                return book && book.isEnglish;
            });
        }
        await dex.run();
    }
}

class LibriVoxGenreBrowser extends LibriVoxActivityBase {

    private categories: ILibriVoxCategory[];

    protected async init(): Promise<void> {
        await super.init();
        const url = `${ROOT_URL}search?primary_key=0&search_category=genre&search_page=1&search_form=get_results`;
        const data = await this.httpGet(url);
        this.categories = extractCategories(data.content);
    }

    private rollCategory(categories: ILibriVoxCategory[]): Rolodex {
        const dex = this.roll();
        for (let i = 0; i < categories.length; ++i) {
            let category = categories[i];
            dex.add(category.name, async () => {
                if (category.subs.length > 0) {
                    await this.rollCategory(category.subs).run();
                } else {

                    const builder: IUrlBuilder = (pageNumber) => {
                        const id = category.id;
                        return `${ROOT_URL}search/get_results?primary_key=${id}&search_category=genre&sub_category=&search_page=${pageNumber}&search_order=alpha&project_type=either`;
                    };
                    const task = this.initSearchResult(builder);
                    await this.exec(new LibriVoxSearchResultBrowser(task));
                }
            });
        }
        return dex;
    }

    async run() {
        await this.rollCategory(this.categories).run();
    }
}

class LibriVoxBookOptions extends LibriVoxActivityBase {

    constructor(private readonly book: ILibriVoxBook) {
        super();
    }

    protected async run() {
        let modified = false;

        this.setInterval(() => {
            this.shelf.update(this.book);
        }, 1000);

        const dex = this.roll();

        dex.add(async () => {
            if (this.book.currentTrackPosition === 0 && !this.book.trackComplete[0])
                return "Start listening";
            return "Continue listening";
        }, async () => {
            await this.exec(new LibriVoxMultiTrackPlayer(this.book));
        });

        dex.add(async () => {
            if (this.book.currentTrackPosition === 0 && !this.book.trackComplete[0])
                return "Start listening with sleep timer";
            return "Continue listening with sleep timer";
        }, async () => {
            const timers = this.roll();

            for (let duration of SLEEP_TIMER_DURATIONS)
                timers.add(duration + " Minutes", async () => duration);

            const durationInMinutes = await timers.run();
            if (durationInMinutes !== undefined) {
                const player = new LibriVoxMultiTrackPlayer(this.book);
                player.sleepTimerManager.startNewTimer(durationInMinutes);
                await this.exec(player);
                if (player.sleepTimerManager.halt)
                    await this.get();
            }
        });

        dex.add("Play from Specific Section", async () => {

            const tracks = this.roll().setActor(Actor.Informational);
            for (let trackIndex = 0; trackIndex < this.book.trackCount; ++trackIndex)
                tracks.add(`Play ` + formatSection(this.book, trackIndex), async () => trackIndex);
            const trackIndex = await tracks.run();

            if (trackIndex !== undefined) {
                this.book.currentTrackPosition = 0;
                for (let i = 0; i < this.book.trackCount; ++i)
                    this.book.trackComplete[i] = i < trackIndex;
                await this.exec(new LibriVoxMultiTrackPlayer(this.book));
            }
        });

        dex.add("Synopsis", async () => {
            const synopsis = this.roll();
            for (let line of this.book.synopsis)
                synopsis.add(line);
            if (synopsis.size === 0) {
                synopsis.add("No synopsis available");
            }
            await synopsis.run({autoskip: true});
        });

        dex.add("Details", async () => {
            await this.roll(
                `Written by: ${this.book.author}`,
                `Read by: ${arrayToText(this.book.readers)}`
            ).run({autoskip: true});
        });

        dex.add("Remove from Bookshelf", async () => {
            modified = true;
            this.shelf.remove(this.book.bookId);
            dex.unwind();
        });

        await dex.run();
        return modified;
    }
}

enum SearchOption {
    ByTitle,
    ByAuthor
}

class LibriVoxSearch extends LibriVoxActivityBase {
    constructor(private readonly option: SearchOption) {
        super();
    }

    private async searchByTitle(title: string) {
        title = title.toLowerCase();
        const builder: IUrlBuilder = (pageNumber) => {
            return `${ROOT_URL}advanced_search?title=${encodeURIComponent(title)}&author=&reader=&keywords=&genre_id=0&status=all&project_type=either&recorded_language=1&sort_order=alpha&search_page=${pageNumber}&search_form=advanced&q=`;
        };
        const task = this.initSearchResult(builder);
        await this.exec(new LibriVoxSearchResultBrowser(task));
    }

    private async searchByAuthor(author: string) {
        author = author.toLowerCase();
        const builder: IUrlBuilder = (pageNumber) => {
            return `${ROOT_URL}advanced_search?title=&author=${encodeURIComponent(author)}&reader=&keywords=&genre_id=0&status=all&project_type=either&recorded_language=1&sort_order=alpha&search_page=${pageNumber}&search_form=advanced&q=`;
        };
        const task = this.initSearchResult(builder);
        await this.exec(new LibriVoxSearchResultBrowser(task));
    }

    protected async run(): Promise<void | any> {

        const searchTerm = await this.getSearchQuery();
        if (searchTerm !== undefined && searchTerm.length > 0) {
            if (this.option === SearchOption.ByTitle)
                await this.searchByTitle(searchTerm);

            if (this.option === SearchOption.ByAuthor)
                await this.searchByAuthor(searchTerm);
        }
        return undefined;
    }
}


export class LibriVoxMainActivity extends LibriVoxActivityBase {
    async run() {
        const dex = this.roll().setActor(Actor.Informational);
        dex.add("My Bookshelf", async () => {
            const bookIds = this.shelf.list(true);
            if (this.shelf.list().length === 0) {
                await this.sayDynamicContent("There are no books on your bookshelf yet.");
            } else {

                const bookRoll = this.roll();
                for (let bookId of bookIds) {
                    const book = this.shelf.get(bookId);
                    bookRoll.add(formatBook(book), async () => {
                        if (await this.exec(new LibriVoxBookOptions(book)))
                            bookRoll.unwind();
                    });
                }

                bookRoll.add("Clear Bookshelf", async () => {
                    if (await this.confirm()) {
                        this.shelf.clear();
                        bookRoll.unwind();
                    }
                });

                await bookRoll.run();
            }
        });
        dex.add("Browse Books by Genre", LibriVoxGenreBrowser);
        dex.add("Search", async () => {
            const searchOptions = this.roll().setActor(Actor.Informational);
            searchOptions.add("Search by Title", async () => await this.exec(new LibriVoxSearch(SearchOption.ByTitle)));
            searchOptions.add("Search by Author", async () => await this.exec(new LibriVoxSearch(SearchOption.ByAuthor)));
            await searchOptions.run();
        });
        dex.add("About LibriVox Audiobooks", async () => {
            await this.exec(new About(about.text));
        });
        await dex.run();
    }
}