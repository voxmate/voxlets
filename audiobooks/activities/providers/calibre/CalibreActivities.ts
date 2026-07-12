import {BasePlayer} from "@voxmate/orc/player";
import voxmate, {Actor, Gesture, VoiceInputMode} from "@voxmate/voxmate";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {BookShelf, BookShelfManager} from "../../../BookShelf";
import {
    AudiobookMultiTrackPlayerActivity,
    IMultiTrackBook,
    SLEEP_TIMER_DURATIONS,
    SleepTimerManager
} from "../../common/TrackPlayer";

import {About} from "../../common/About";
import about from "./about.json";

import cheerio from "cheerio";
import furl from "form-urlencoded";

const CalibreBookShelfProvider = "CALIBRE";
const CalibreRootUrl = "https://www.calibre.org.uk/";

const LS_USERNAME_KEY = "CalibreUsername";
const LS_PASSWORD_KEY = "CalibrePassword";
const LS_SECRET_KEY = "CalibreSiteUser";
const LS_SECRET_UPDATED = "CalibreSiteUserUpdated";
const LS_CACHE_FILE_ID = "CalibreCacheFile";

interface IAudiobookConfig {
    calibre_credentials: string;
}

interface ICalibreBookQuery {
    name: string;
    categoryListingUrl: string;
    abbr: string;
}

interface ICalibreBookDescriptor {
    title: string;
    bookId: string;
    reader: string;
    author: string;
    rating: string;
    categories: string[];
}

interface ICalibreBookDetails {
    synopsis: string[];
    isAvailableOnline: boolean;
}

interface ICalibreBook extends ICalibreBookDescriptor, ICalibreBookDetails, IMultiTrackBook {

}

interface ICalibreBookCollection {
    pagesCount: number;
    booksCount: number;
    categoryListingUrl: string;
    books: (ICalibreBookDescriptor | undefined)[];
}

interface ICalibreAuthorDetails {
    name: string;
    contentUrl: string;
}

interface ICalibreCredentials {
    username: string;
    password: string;
}

class CalibreGeneralError {
    constructor(readonly msg: string) {
    }
}

class CalibreAuthenticationFail extends CalibreGeneralError {
    constructor(readonly step: string) {
        super("Failed Authentication Process");
    }
}

function titleCase(text: string): string {
    const wordArray = text.toLowerCase().split(' ');
    for (let i = 0; i < wordArray.length; ++i) {
        wordArray[i] = wordArray[i].charAt(0).toUpperCase() + wordArray[i].slice(1);
    }
    return wordArray.join(' ');
}

function trimHtmlText(text: string): string {
    text = text.split("\n").join(" ").trim();
    return text.replace(/\s+/g, " ");
}

function unwindArticleSuffix(text: string) {
    const theSuffix = ", The";
    const aSuffix = ", A";
    if (text.endsWith(theSuffix)) {
        return "The " + text.substr(0, text.length - theSuffix.length);
    } else if (text.endsWith(aSuffix)) {
        return "A " + text.substr(0, text.length - aSuffix.length);
    } else {
        return text;
    }
}

function extractSingle(str: string, regex: RegExp): string {

    let m;
    if ((m = regex.exec(str)) !== null) {
        if (m.index === regex.lastIndex)
            regex.lastIndex++;
        let actualMatch: string = "";
        m.forEach((match) => {
            actualMatch = match;
        });
        return actualMatch;
    }

    return "";

}

abstract class CalibreBaseActivity extends RollActivity {

    private get bookshelf(): BookShelf<ICalibreBook> {
        return this[BookShelf.inject];
    }

    static username: string;
    static password: string;

    private async getCredentials(): Promise<ICalibreCredentials> {
        const config = await this.configuration() as IAudiobookConfig;
        return JSON.parse(config.calibre_credentials || "{}") as ICalibreCredentials;
    }

    private async getSessionSecret(): Promise<string> {

        const credentials = await this.getCredentials();

        if (!credentials.username) {
            localStorage.removeItem(LS_USERNAME_KEY);
            localStorage.removeItem(LS_PASSWORD_KEY);
            throw new CalibreAuthenticationFail("Please set Calibre member account and password in the portal");
        }

        const oldUserName = localStorage.getItem(LS_USERNAME_KEY) ?? "";
        const oldPassword = localStorage.getItem(LS_PASSWORD_KEY) ?? "";

        CalibreBaseActivity.username = credentials.username;
        CalibreBaseActivity.password = credentials.password;

        if (credentials.username === oldUserName && credentials.password === oldPassword) {
            return this.login();
        } else {
            localStorage.removeItem(LS_SECRET_KEY);
            localStorage.removeItem(LS_SECRET_UPDATED);
        }

        const result = await this.login(true);
        localStorage.setItem(LS_USERNAME_KEY, credentials.username);
        localStorage.setItem(LS_PASSWORD_KEY, credentials.password);

        return result;
    }

    // noinspection SpellCheckingInspection
    private async login(force: boolean = false): Promise<string> {

        if (!force) {
            const updated = localStorage.getItem(LS_SECRET_UPDATED);
            if (updated) {
                let tick = parseInt(updated);
                if (tick + 24 * 60 * 60 * 1000 > new Date().getTime()) {
                    return localStorage.getItem(LS_SECRET_KEY);
                }
            }
        }

        function extractCookie(headers: any, targetCookie: string): string {

            let cookieValue = "";
            for (let cookie of headers["Set-Cookie"]) {
                if (cookie.startsWith(targetCookie)) {
                    cookieValue = cookie;
                    break;
                }
            }

            if (cookieValue === "")
                throw new CalibreAuthenticationFail("Failed to Authenticate with Calibre Service. " +
                    "Please Check your Username and Password in the portal.");

            cookieValue = cookieValue.substr(0, cookieValue.indexOf(";"));

            return cookieValue;
        }

        function extractFromInputField(lines: string[], search: string) {
            for (let line of lines) {
                if (line.indexOf(search) !== -1) {
                    const parts = line.split("value=\"");
                    const valuePart = parts[1];
                    return valuePart.substr(0, valuePart.indexOf("\""));
                }
            }

            throw new CalibreAuthenticationFail("Calibre Service Profile Changed. Unable to Connect.");
        }

        console.log("Performing Full Login");

        const loginUrl = CalibreRootUrl + "login.aspx?destination=Library.aspx";

        const loginPage = await this.httpGet(loginUrl);
        const sessionCookie = extractCookie(loginPage.headers, "ASP.NET_SessionId");

        const lines = loginPage.content.split("\n");
        const viewState = extractFromInputField(lines, "__VIEWSTATE\"");

        const viewStateGenerator = extractFromInputField(lines, "__VIEWSTATEGENERATOR\"");
        const eventValidation = extractFromInputField(lines, "__EVENTVALIDATION\"");

        const authPayload = furl({
            "__VIEWSTATE": viewState,
            "__VIEWSTATEGENERATOR": viewStateGenerator,
            "__EVENTVALIDATION": eventValidation,
            "__EVENTTARGET": "",
            "__EVENTARGUMENT": "",
            "ctl00$main$LoginButton": "> Continue",
            "ctl00$main$UserName": CalibreBaseActivity.username,
            "ctl00$main$Password": CalibreBaseActivity.password
        });

        const data = await this.httpMakeRequest(loginUrl, "POST", authPayload, {
            "Cookie": sessionCookie,
            "Content-Type": "application/x-www-form-urlencoded"
        });

        const secret = extractCookie(data.headers, "SiteUser");
        const now = new Date().getTime();

        localStorage.setItem(LS_SECRET_KEY, secret);
        localStorage.setItem(LS_SECRET_UPDATED, now.toString());

        return secret;

    }

    private async getHeaders(): Promise<any> {
        return {
            "Cookie": await this.getSessionSecret()
        };
    }

    private async getSecureUrlFor(bookId: string, trackId: number): Promise<string> {

        const lookupUrl = CalibreRootUrl + `SecureMp3Url.ashx?book=${bookId}&track=${trackId}`;
        const data = await this.httpGet(lookupUrl, await this.getHeaders());

        try {
            const tag = data.content.split("source src=\"")[1];
            return tag.substr(0, tag.indexOf("\" type=\"audio"));
        } catch (e) {
            throw new CalibreGeneralError("Unable to parse Secure Mp3 Content");
        }
    }

    private static extractBooksFromListing($: cheerio.Root): ICalibreBookDescriptor[] {

        const books: ICalibreBookDescriptor[] = [];

        const boxes = $(".parametres-box").get();
        for (let box of boxes) {
            const boxData = $(box);
            const title = unwindArticleSuffix(titleCase(trimHtmlText(boxData.find("h2").text())));
            const bookId = boxData.find("h2").find("a").attr("href").split("?item=")[1];

            let reader = "";
            let author = "";
            let rating = "";
            const categories: string[] = [];

            for (let infoData of boxData.find("li").get()) {
                const infoBlock = $(infoData);
                const text = trimHtmlText(infoBlock.text());
                if (text.indexOf("Reader:") !== -1) {
                    reader = trimHtmlText(infoBlock.find("a").text());
                }

                if (text.indexOf("Author:") !== -1) {
                    author = trimHtmlText(infoBlock.find("a").text());
                }

                if (text.indexOf("Rating:") !== -1) {
                    rating = trimHtmlText(infoBlock.find("li").text());
                }

                if (text.indexOf("Category:") !== -1) {
                    const categoryBlocks = infoBlock.find("ul").find("li").get();
                    for (let categoryData of categoryBlocks) {
                        categories.push(trimHtmlText($(categoryData).find("a").text()).substr(4).trim());
                    }
                }
            }

            books.push({
                author: author,
                bookId: bookId,
                categories: categories,
                rating: rating,
                reader: reader,
                title: title
            });
        }

        return books;
    }

    private async determineNumberOfTracks(bookId: string) {
        let guess = 30;
        let step = 30;
        const probes = [];
        while (this.isActive) {

            let hit = probes[guess];
            if (hit === undefined) {
                hit = await this.checkTrackExists(bookId, guess);
            }

            probes[guess] = hit;
            let nextGuess = guess + step;
            if (!hit) {
                step = Math.max(1, Math.floor(step / 2));
                nextGuess = guess - step;
                if (probes[nextGuess])
                    return nextGuess;
            }

            guess = nextGuess;
        }
    }

    protected async haveCredentials() {
        const credentials = await this.getCredentials();
        return !!(credentials && credentials.username);
    }

    protected async haveValidCredentials(): Promise<boolean> {
        try {
            await this.getSessionSecret();
            return true;
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            console.log(JSON.stringify(e));
            return false;
        }
    }

    protected async checkTrackExists(bookId: string, trackId: number): Promise<boolean> {
        const url = await this.getSecureUrlFor(bookId, trackId);
        try {
            await this.httpGet(url, {"Range": "bytes=0-1"});
        } catch (e) {
            if (typeof e === "string") {
                if (e.startsWith("(404) Not Found"))
                    return false;
            }
            throw e;
        }
        return true;
    }

    protected async initCalibreBook(book: ICalibreBookDescriptor): Promise<ICalibreBook> {

        const trackCount = await this.determineNumberOfTracks(book.bookId);
        const details = await this.getBookDetails(book.bookId);

        const trackComplete: boolean[] = [];
        for (let i = 0; i < trackCount; ++i)
            trackComplete[i] = false;

        return {
            trackCount: trackCount,
            trackComplete: trackComplete,
            currentTrackPosition: 0,
            playbackSpeed: 1,
            lastListenedTimestamp: 0,
            ...book,
            ...details
        };
    }

    protected async getTrackResourceId(bookId: string, trackId: number): Promise<string> {

        let cache: { trackId: number, bookId: string, resourceId: string } =
            JSON.parse(localStorage.getItem(LS_CACHE_FILE_ID) ?? "{}");

        if (cache.bookId === bookId && cache.trackId === trackId) {
            return cache.resourceId;
        }

        const url = await this.getSecureUrlFor(bookId, trackId);

        if (cache.resourceId)
            await this.wrap(voxmate.filestore.clear(cache.resourceId));
        const resourceId = await this.wrap(voxmate.filestore.save(url, true, {}, null));
        cache = {trackId: trackId, bookId: bookId, resourceId: resourceId};
        localStorage.setItem(LS_CACHE_FILE_ID, JSON.stringify(cache));

        return resourceId.toString();
    }

    protected async listCategories(): Promise<ICalibreBookQuery[]> {

        const data = await this.httpGet(CalibreRootUrl + "library.aspx?cattype=2");
        const $ = cheerio.load(data.content);
        const links = $(".container").find("a");

        const categories: ICalibreBookQuery[] = [];
        for (let i = 0; i < links.length; ++i) {

            const link = $(links.get(i));
            const url = link.attr("href");

            const fieldContent = trimHtmlText(link.text());
            const abbr = fieldContent.substr(0, 3);
            const name = fieldContent.substr(4).trim();

            categories.push({
                categoryListingUrl: CalibreRootUrl + url,
                abbr: abbr,
                name: name
            });
        }

        return categories;
    }

    protected async getQueryBookCollection(url: string): Promise<ICalibreBookCollection> {

        const data = await this.httpGet(url);

        const $ = cheerio.load(data.content);
        const pageCountText = trimHtmlText($("#ctl00_main_pageCount").text());
        const pagesCount = parseInt(pageCountText.split(" of ")[1]);

        const booksCountText = trimHtmlText($("#ctl00_main_LibraryTitle").text());
        const booksCount = parseInt(extractSingle(booksCountText, /\((\d+) Boo/gm));

        const page1Books = CalibreBaseActivity.extractBooksFromListing($);

        const books = Array(booksCount);
        for (let i = 0; i < page1Books.length; ++i) {
            books[i] = page1Books[i];
        }

        return {
            books: books,
            booksCount: booksCount,
            pagesCount: pagesCount,
            categoryListingUrl: url
        };
    }

    protected async getBookDescriptor(metadata: ICalibreBookCollection, index: number): Promise<ICalibreBookDescriptor> {

        if (metadata.books[index])
            return metadata.books[index];

        const page = Math.floor(index / 10) + 1;
        const url = metadata.categoryListingUrl + "&page=" + page;

        const data = await this.httpGet(url);
        const $ = cheerio.load(data.content);
        const books = CalibreBaseActivity.extractBooksFromListing($);

        const pageStartIndex = (page - 1) * 10;
        for (let i = 0; i < books.length; ++i) {
            metadata.books[i + pageStartIndex] = books[i];
        }

        return metadata.books[index];
    }

    protected async getBookDetails(bookId: string): Promise<ICalibreBookDetails> {
        const url = `${CalibreRootUrl}library.aspx?item=${bookId}`;
        const data = await this.httpGet(url);
        const $ = cheerio.load(data.content);

        const synopsis = [];
        const parts = $(".container").find("p").get();
        for (let part of parts) {
            synopsis.push(...voxmate.utility.splitIntoSentences(trimHtmlText($(part).text())));
        }

        const isAvailableOnline = data.content.indexOf("Listen Online") !== -1;


        return {
            synopsis: synopsis,
            isAvailableOnline: isAvailableOnline
        };
    }

    protected async search(query: string): Promise<ICalibreBookCollection> {
        const searchUrl = CalibreRootUrl + "library.aspx?search=" + encodeURIComponent(query) + "&field=0&filter=0";

        const data = await this.httpGet(searchUrl);
        const $ = cheerio.load(data.content);

        const pageCountText = trimHtmlText($("#ctl00_main_pageCount").text());
        const pagesCount = parseInt(pageCountText.split(" of ")[1]);

        const page1Books = CalibreBaseActivity.extractBooksFromListing($);

        let booksCount = page1Books.length;
        if (pagesCount > 1) {
            const lastPageUrl = CalibreRootUrl + "library.aspx?search=" + encodeURIComponent(query) + "&field=0&filter=0&page=" + pagesCount;
            const lastPageData = await this.httpGet(lastPageUrl);
            const lastPageBooks = CalibreBaseActivity.extractBooksFromListing(cheerio.load(lastPageData.content));
            booksCount = (pagesCount - 1) * 10 + lastPageBooks.length;
        }

        const books = Array(booksCount);
        for (let i = 0; i < page1Books.length; ++i) {
            books[i] = page1Books[i];
        }

        return {
            books: books,
            booksCount: booksCount,
            pagesCount: pagesCount,
            categoryListingUrl: searchUrl
        };

    }

    protected async getAuthorsList(letter: string): Promise<ICalibreAuthorDetails[]> {

        const url = CalibreRootUrl + "libraryauthor.aspx?mediafilter=0&init=" + letter.toUpperCase();
        const list = await this.httpGet(url);
        const $ = cheerio.load(list.content);
        const links = $(".book-holder").find("h2").find("a").get();

        const authors: ICalibreAuthorDetails[] = [];

        for (let link of links) {
            const el = $(link);
            const url = el.attr("href");
            const name = trimHtmlText(el.text());

            authors.push({
                contentUrl: url,
                name: name
            });
        }

        return authors;
    }

    protected async getAuthorBooks(author: ICalibreAuthorDetails): Promise<ICalibreBookCollection | null> {

        let firstBookUrl: string;
        {
            const data = await this.httpGet(CalibreRootUrl + author.contentUrl);
            const $ = cheerio.load(data.content);
            const firstBookBlock = $($(".parametres-list").find("li").get(0));
            firstBookUrl = CalibreRootUrl + firstBookBlock.find("a").attr("href");
        }

        let authorSearchUrl = "";
        {
            const data = await this.httpGet(firstBookUrl);
            const $ = cheerio.load(data.content);
            const hyperlinks = $(".container").find("a").get();
            for (let link of hyperlinks) {
                const href = $(link).attr("href");
                if (href.indexOf("library.aspx?author=") !== -1) {
                    authorSearchUrl = href;
                    break;
                }
            }
        }

        if (authorSearchUrl === "")
            return null;

        authorSearchUrl = CalibreRootUrl + authorSearchUrl;

        return await this.getQueryBookCollection(authorSearchUrl);
    }

    // Book Shelf Management


    get shelf(): BookShelfManager<ICalibreBook> {
        return new BookShelfManager<ICalibreBook>(CalibreBookShelfProvider, this.bookshelf);
    }
}

class CalibrePlayerActivity extends CalibreBaseActivity {

    readonly sleepTimerManager: SleepTimerManager;
    private readonly cls;

    constructor(private readonly book: ICalibreBook) {
        super();
        const that = this;
        const cls = this.cls = new (class extends AudiobookMultiTrackPlayerActivity<ICalibreBook> {
            // noinspection JSUnusedGlobalSymbols
            async getTrackResourceId(book: ICalibreBook, trackIndex: number): Promise<string> {
                return that.getTrackResourceId(book.bookId, trackIndex + 1);
            }
        })(this.book);
        this.sleepTimerManager = cls.sleepTimerManager;
    }

    protected async run(): Promise<void | any> {
        await this.exec(this.cls);
    }
}

class CalibreBookActivity extends CalibreBaseActivity {
    constructor(private readonly book: ICalibreBook) {
        super();
    }

    protected async run(): Promise<boolean> {
        let modified = false;
        const dex = this.roll();

        this.setInterval(() => {
            this.shelf.update(this.book);
        }, 1000);

        dex.add(async () => {
            if (this.book.currentTrackPosition === 0 && !this.book.trackComplete[0])
                return "Start listening";
            return "Continue listening";
        }, async () => {
            await this.exec(new CalibrePlayerActivity(this.book));
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
                const player = new CalibrePlayerActivity(this.book);
                player.sleepTimerManager.startNewTimer(durationInMinutes);
                await this.exec(player);
                if (player.sleepTimerManager.halt)
                    await this.get();
            }
        });

        dex.add("Play from Specific Track", async () => {
            const tracks = this.roll().setActor(Actor.Informational);
            for (let i = 0; i < this.book.trackCount; ++i)
                tracks.add(`Play Track ${i + 1}`, async () => i);
            const trackIndex = await tracks.run();

            if (trackIndex !== undefined) {
                this.book.currentTrackPosition = 0;
                for (let i = 0; i < this.book.trackCount; ++i)
                    this.book.trackComplete[i] = i < trackIndex;
                await this.exec(new CalibrePlayerActivity(this.book));
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
                `Read by: ${this.book.reader}`
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

class CalibreAddBookToBookShelfActivity extends CalibreBaseActivity {

    private alreadyHaveBook = false;

    constructor(private readonly descriptor: ICalibreBookDescriptor) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        this.alreadyHaveBook = this.shelf.checkBook(this.descriptor.bookId);
        if (!this.alreadyHaveBook) {
            const book = await this.initCalibreBook(this.descriptor);
            this.shelf.add(book);
        }
    }

    protected async run(): Promise<void> {
        if (!this.alreadyHaveBook)
            await this.say(`${this.descriptor.title} has been added to your bookshelf`);
        else await this.say(`${this.descriptor.title} is already on your bookshelf`);
    }
}

class CalibrePreviewPlayerActivity extends BasePlayer {

    private resourceId: string;

    constructor(private readonly task: Promise<string>) {
        super();
    }

    protected async init(): Promise<any> {
        this.resourceId = await this.task;
        await super.init();
    }

    protected getPlayerResourceId(): string {
        return this.resourceId;
    }
}

class CalibreBrowseCollectionActivity extends CalibreBaseActivity {

    constructor(private readonly collection: ICalibreBookCollection) {
        super();
    }

    protected async run() {
        const dex = this.roll();
        for (let i = 0; i < this.collection.books.length; ++i) {
            dex.add(async () => {
                const book = await this.freeze(this.getBookDescriptor(this.collection, i));
                await this.sayDynamicContent(`${book.title}, by ${book.author}`);
                await dex.paginate(i, this.collection.books.length);
            }, async () => {
                const desc = this.roll().setActor(Actor.Informational);
                const book = await this.getBookDescriptor(this.collection, i);

                desc.add("Play Sample", async () => {

                    const bookData = await this.getBookDetails(book.bookId);
                    if (!bookData.isAvailableOnline) {
                        await this.sayDynamicInfo("This book is not available for online listening, due to copyright restrictions.");
                        return;
                    }

                    let track = 4;
                    if (!await this.checkTrackExists(book.bookId, track))
                        track = 1;

                    if (!await this.checkTrackExists(book.bookId, track)) {
                        await this.sayDynamicContent("Unable to find any tracks");
                    } else {
                        const resourceIdTask = this.getTrackResourceId(book.bookId, track);
                        await this.exec(new CalibrePreviewPlayerActivity(resourceIdTask));
                    }
                });

                desc.add("Synopsis", async () => {
                    const synopsis = this.roll();
                    const bookData = await this.getBookDetails(book.bookId);
                    for (let line of bookData.synopsis)
                        synopsis.add(line);

                    if (synopsis.size === 0) {
                        synopsis.add("No synopsis available");
                    }

                    await synopsis.run({autoskip: true});
                });

                desc.add("Details", async () => {
                    await this.roll(
                        `Written by: ${book.author}`,
                        `Read by: ${book.reader}`
                    ).run({autoskip: true});
                });

                desc.add("Add to My Bookshelf", async () => {

                    const bookData = await this.getBookDetails(book.bookId);
                    if (!bookData.isAvailableOnline) {
                        await this.sayDynamicInfo("This book is not available for online listening, due to copyright restrictions.");
                        return;
                    }

                    await this.exec(new CalibreAddBookToBookShelfActivity(book));
                });

                await desc.run();
            });
        }
        await dex.run({isContentInformational: true});
    }
}

class CalibreLibraryCategoryActivity extends CalibreBaseActivity {

    categories: ICalibreBookQuery[] = [];

    protected async init(): Promise<void> {
        await super.init();
        this.categories = await this.listCategories();
    }

    protected async run() {
        const dex = this.roll();
        for (let category of this.categories) {
            dex.add(category.name, async () => {
                const data = await this.freeze(this.getQueryBookCollection(category.categoryListingUrl));
                await this.exec(new CalibreBrowseCollectionActivity(data));
            });
        }
        await dex.run();
    }
}

class CalibreLibraryAuthorActivity extends CalibreBaseActivity {

    async hint() {
        return "Pick Author By First Character of His or Her last name";
    }

    protected async run(): Promise<void> {
        const dex = this.roll();
        for (let char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
            dex.add(char, async () => {
                const charAuthors = await this.freeze(this.getAuthorsList(char));
                const charAuthorDex = this.roll();
                for (let author of charAuthors) {
                    charAuthorDex.add(author.name, async () => {
                        const books = await this.freeze(this.getAuthorBooks(author));
                        if (books === null) {
                            await this.sayDynamicInfo("Sorry, this author doesn't have any listed books");
                        } else {
                            await this.exec(new CalibreBrowseCollectionActivity(books));
                            dex.unwind();
                        }
                    });
                }
                await charAuthorDex.run({isContentInformational: true});
            });
        }
        await dex.run();
    }
}


export class CalibreActivities extends CalibreBaseActivity {

    private haveInvalidCredentials = false;

    private async checkAccountValidity() {
        const haveCredentials = await this.haveCredentials();
        if (haveCredentials) {
            const haveValidCredentials = await this.haveValidCredentials();
            if (!haveValidCredentials) {
                this.haveInvalidCredentials = true;
            }
        }
    }

    protected async init(): Promise<void> {
        await super.init();
        await this.checkAccountValidity();
    }

    constructor() {
        super();
    }

    async hint() {
        const haveCredentials = await this.haveCredentials();
        if (!haveCredentials) {
            return "Please log in to my.voxmate.com and add your Calibre " +
                "membership number and password in order to be able to listen to the Audiobooks";
        }
        return null;
    }

    protected async run() {

        while (this.isActive) {

            const dex = this.roll().setActor(Actor.Informational);

            dex.add("Missing Credentials", async () => {
                await this.invokeHint();
                await this.sayDynamicInfo("You can browse the catalog without credentials, " +
                    "but you will not be able to listen to any books without adding your Calibre account in the portal");
            }).showWhen(async () => !await this.haveCredentials());

            dex.add("Invalid Credentials", async () => {
                this.setTimeout(async () => {
                    await this.checkAccountValidity();
                });
                await this.sayDynamicInfo("The credentials you have supplied in the portal are invalid.");
                await this.sayDynamicInfo("Please try again.");
            }).showWhen(async () => this.haveInvalidCredentials);

            dex.add("My Bookshelf", async () => {
                const books = this.shelf.list(true);
                if (books.length === 0) {
                    await this.sayDynamicInfo("There are no books on your bookshelf yet.");
                } else {
                    const bookRoll = this.roll();
                    for (let bookShelfId of books) {
                        bookRoll.add(async () => {
                            const book = this.shelf.get(bookShelfId);
                            return book.title;
                        }, async () => {
                            const book = this.shelf.get(bookShelfId);
                            const modified = await this.exec(new CalibreBookActivity(book));
                            if (modified)
                                bookRoll.unwind();
                        });
                    }
                    bookRoll.add("Clear Bookshelf", async () => {

                        let ui = await this.sayDynamicInfo("Swipe again to confirm. All your books will be removed.");

                        if (!ui) {
                            ui = await this.get();
                        }

                        if (ui.kind == "gesture") {
                            if (ui.gesture === Gesture.DoubleTap || ui.gesture === Gesture.Right) {
                                this.shelf.clear();
                                bookRoll.unwind();
                            }
                        }
                    });

                    await bookRoll.run();
                }
            });

            dex.add("Books By Category", async () => {
                await this.exec(new CalibreLibraryCategoryActivity());
            });

            dex.add("Books By Author", async () => {
                await this.exec(new CalibreLibraryAuthorActivity());
            });

            dex.add("Search", async () => {
                const activity = new (class extends CalibreBaseActivity {

                    constructor() {
                        super({voiceInputMode: VoiceInputMode.CommandInput});
                    }

                    // noinspection JSUnusedGlobalSymbols
                    async onVoiceCommand(command: string): Promise<any> {
                        return {"search": command};
                    }

                    protected async run() {

                        const that = this;
                        while (this.isActive) {
                            await this.saySkipping("Use the double tap command to search for a book.");
                            const ui = await this.get();
                            if (ui.kind === "object") {
                                const searchTerm = ui.object["search"] as string || null;
                                await this.saySkippingDynamicContent(`Searching for: ${searchTerm}`);
                                const collection = await this.freeze(this.search(searchTerm));
                                if (collection.books.length === 0) {
                                    await this.sayDynamicInfo(`Unable to find anything for: ${searchTerm}`);
                                } else {
                                    await that.exec(new CalibreBrowseCollectionActivity(collection));
                                    break;
                                }
                            }
                        }
                    }
                });
                await this.exec(activity);
            });

            dex.add("About Calibre Audiobooks", async () => {
                await this.exec(new About(about.text));
            });

            try {
                await dex.run();
                break;
            } catch (e) {
                if (e instanceof CalibreAuthenticationFail) {
                    await this.sayDynamicInfo(e.step);
                } else throw e;
            }
        }
    }
}