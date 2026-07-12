import {IService} from "@voxmate/orc/orc";

function makeCompositeKey(provider: string, bookId: string) {
    return "__bookshelf_books_" + provider + "_" + bookId;
}

function makeListKey(provider: string) {
    return "__bookshelf_list_" + provider;
}

function getList(provider: string): string[] {
    return JSON.parse(localStorage.getItem(makeListKey(provider)) ?? "[]");
}

function setList(provider: string, list: string[]) {
    localStorage.setItem(makeListKey(provider), JSON.stringify(list));
}

export interface IBookShelfBook {
    bookId: string;
    lastListenedTimestamp: number;
}

export class BookShelf<T extends IBookShelfBook> implements IService {

    static inject = Symbol("Bookshelf");

    checkBookExists(provider: string, bookId: string): boolean {
        return getList(provider).indexOf(bookId) !== -1;
    }

    addBook(provider: string, bookData: T): boolean {

        if (this.checkBookExists(provider, bookData.bookId))
            return false;

        this.updateBook(provider, bookData);
        const list = getList(provider);
        list.push(bookData.bookId);
        setList(provider, list);
        return true;
    }

    updateBook(provider: string, bookData: T) {
        const key = makeCompositeKey(provider, bookData.bookId);
        localStorage.setItem(key, JSON.stringify(bookData));
    }

    getBook(provider: string, bookShelfId: string): T | null {
        const key = makeCompositeKey(provider, bookShelfId);
        const json = localStorage.getItem(key);
        if (!json)
            return null;
        return JSON.parse(json);
    }

    listBooks(provider: string): string[] {
        return getList(provider);
    }

    removeBook(provider, bookId: string) {

        const key = makeCompositeKey(provider, bookId);
        localStorage.removeItem(key);

        const list = getList(provider);
        const idx = list.indexOf(bookId);
        if (idx !== -1) {
            list.splice(idx, 1);
        }

        setList(provider, list);
    }

    clear(provider: string) {
        const booksIds = getList(provider);
        for (let bookId of booksIds)
            this.removeBook(provider, bookId);
        localStorage.removeItem(makeListKey(provider));
    }
}

export class BookShelfManager<T extends IBookShelfBook> {

    constructor(private readonly provider: string, private readonly bookshelf: BookShelf<T>) {
    }

    add(book: T): boolean {
        return this.bookshelf.addBook(this.provider, book);
    }

    update(book: T) {
        this.bookshelf.updateBook(this.provider, book);
    }

    get(bookId: string): T | null {
        return this.bookshelf.getBook(this.provider, bookId);
    }

    list(sorted: boolean = false): string[] {
        const bookIds = this.bookshelf.listBooks(this.provider);

        if (sorted) {
            const bookDetails: T[] = [];
            for (let bookId of bookIds)
                bookDetails.push(this.get(bookId));

            bookDetails.sort((a, b) => {
                if (a.lastListenedTimestamp < b.lastListenedTimestamp)
                    return 1;
                if (b.lastListenedTimestamp < a.lastListenedTimestamp)
                    return -1;
                return 0;
            });

            return bookDetails.map(b => b.bookId);
        }

        return bookIds;
    }

    remove(bookId: string) {
        return this.bookshelf.removeBook(this.provider, bookId);
    }

    clear() {
        this.bookshelf.clear(this.provider);
    }

    checkBook(bookId: string): boolean {
        return this.bookshelf.checkBookExists(this.provider, bookId);
    }
}