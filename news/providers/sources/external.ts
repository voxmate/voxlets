import {
    IRssEngineFeedNewsProviderConfiguration,
} from "../providers";

export const RssFeedNewsProviderConfigurations: IRssEngineFeedNewsProviderConfiguration[] = [
    {
        rootUrl: "https://nypost.com/",
        uid: "newYorkPost",
        engine: "mercury",
        categories: [
            {name: "All articles", feedUrl: "feed/", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "Syndicated news and opinion website providing continuously updated headlines to top news and analysis sources.",
            name: "New York Post"
        }
    }, {
        rootUrl: "https://mashable.com/",
        uid: "mashable",
        engine: "mercury",
        categories: [
            {name: "Top Stories", feedUrl: "feed", listable: true},
            {name: "Culture", feedUrl: "culture/feed", listable: true},
            {name: "Social good", feedUrl: "category/social-good/feed", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An American digital media website founded in 2005.",
            name: "Mashable"
        }
    },

    {
        rootUrl: "https://www.cnet.com/rss/",
        uid: "cnet",
        engine: "mercury",
        categories: [
            {name: "All Articles", feedUrl: "all/", listable: true},
            {name: "News", feedUrl: "news/", listable: true},
            {name: "Reviews", feedUrl: "reviews/", listable: true},
            {name: "How to", feedUrl: "how-to/", listable: true},
            {name: "Android Update", feedUrl: "android-update/", listable: true},
            {name: "Most Popular Products", feedUrl: "most-popular-products/", listable: true},
            {name: "Smart Home", feedUrl: "smart-home/", listable: true},
            {name: "Cheapskate", feedUrl: "cheapskate/", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An American media website that publishes reviews," +
                " news and articles on technology and consumer electronics globally.",
            name: "CNET"
        }
    },

    {
        rootUrl: "https://observer.com/",
        uid: "observer",
        engine: "mercury",
        categories: [
            {name: "All Articles", feedUrl: "feed/", listable: true}
        ],
        descriptor: {
            language: "en",
            description: "An American online media company that offers a take " +
                "on the latest in news, business, arts and entertainment.",
            name: "Observer"
        }
    },

    {
        rootUrl: "https://feeds.feedburner.com/fastcompany/",
        uid: "fastCompany",
        engine: "readability",
        categories: [
            {name: "All Articles", feedUrl: "headlines", listable: true}
        ],
        descriptor: {
            language: "en",
            description: "An American business magazine published in print and " +
                "online that focuses on technology, business, and design.",
            name: "Fast Company"
        }
    },

    {
        rootUrl: "https://www.rollingstone.com/",
        uid: "rollingStone",
        engine: "mercury",
        categories: [
            {name: "All Articles", feedUrl: "feed/", listable: true},
            {name: "Music", feedUrl: "music/feed/", listable: true},
            {name: "Politics", feedUrl: "politics/feed/", listable: true},
            {name: "Culture", feedUrl: "culture/feed/", listable: true},
            {name: "Movies", feedUrl: "movies/feed/", listable: true},
            {name: "TV", feedUrl: "tv/feed/", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An American music magazine, founded in 1967. Has a mix of content," +
                " including music, entertainment and politics.",
            name: "Rolling Stone"
        }
    },

    {
        rootUrl: "http://www.cnbc.com/id/",
        uid: "cnbc",
        engine: "mercury",
        categories: [
            {name: "Top News and Analysis", feedUrl: "19746125/device/rss/rss.xml", listable: true},
            {name: "Business", feedUrl: "10001147/device/rss/rss.html", listable: true},
            {name: "Earnings", feedUrl: "15839135/device/rss/rss.html", listable: true},
            {name: "Commentary", feedUrl: "100370673/device/rss/rss.html", listable: true},
            {name: "Economy", feedUrl: "20910258/device/rss/rss.html", listable: true},
            {name: "Finance", feedUrl: "10000664/device/rss/rss.html", listable: true},
            {name: "Technology", feedUrl: "19854910/device/rss/rss.html", listable: true},
            {name: "Politics", feedUrl: "10000113/device/rss/rss.html", listable: true},
            {name: "Health and Science", feedUrl: "10000108/device/rss/rss.html", listable: true},
            {name: "Wealth", feedUrl: "10001054/device/rss/rss.html", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "International business news, world news and global stock market analysis.",
            name: "CNBC"
        }

    },

    {
        rootUrl: "https://www.theverge.com/",
        uid: "theVerge",
        engine: "readability",
        categories: [
            {name: "Top Stories", feedUrl: "rss/index.xml", listable: true},
            {name: "Tech", feedUrl: "tech/rss/index.xml", listable: true},
            {name: "Culture", feedUrl: "culture/rss/index.xml", listable: true},
            {name: "Science", feedUrl: "science/rss/index.xml", listable: true},
            {name: "Transportation", feedUrl: "transportation/rss/index.xml", listable: true},
            {name: "Reviews", feedUrl: "reviews/rss/index.xml", listable: true},
            {name: "Features", feedUrl: "rss/features/index.xml", listable: true},
            {name: "Exclusives", feedUrl: "rss/exclusive/index.xml", listable: true},
            {name: "Circuit Breaker", feedUrl: "circuitbreaker/rss/index.xml", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An American technology-news online magazine, publishing news, " +
                "feature stories, guidebooks, product reviews, and podcasts.",
            name: "The Verge"
        }
    },

    {
        rootUrl: "https://www.vox.com/rss/",
        uid: "vox",
        engine: "mercury",
        categories: [
            {name: "Top Stories", feedUrl: "index.xml", listable: true},
            {name: "Recode", feedUrl: "recode/index.xml", listable: true},
            {name: "The Goods", feedUrl: "the-goods/index.xml", listable: true},
            {name: "The Highlight", feedUrl: "the-highlight/index.xml", listable: true},
            {name: "Future Perfect", feedUrl: "future-perfect/index.xml", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An American news and opinion website, noted for its concept of explanatory journalism.",
            name: "Vox"
        }
    },

    {
        rootUrl: "http://feeds.foxnews.com/foxnews/",
        uid: "foxNews",
        engine: "readability",
        categories: [
            {name: "Latest Headlines", feedUrl: "latest", listable: true},
            {name: "Entertainment", feedUrl: "entertainment", listable: true},
            {name: "Politics", feedUrl: "politics", listable: true},
            {name: "Tech", feedUrl: "tech", listable: true},
            {name: "Health", feedUrl: "health", listable: true},
            {name: "Science", feedUrl: "science", listable: true},
            {name: "Opinion", feedUrl: "opinion", listable: true},
            {name: "Sports", feedUrl: "sports", listable: true},
            {name: "U.S.", feedUrl: "national", listable: true},
            {name: "World", feedUrl: "world", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "News website of an American cable television news channel.",
            name: "Fox News"
        }
    },

    {
        rootUrl: "http://feeds.nbcnews.com/nbcnews/public/",
        uid: "nbcNews",
        engine: "mercury",
        categories: [
            {name: "Top Stories", feedUrl: "news", listable: true},
            {name: "U.S. News", feedUrl: "us-news", listable: true},
            {name: "World", feedUrl: "world", listable: true},
            {name: "Business", feedUrl: "business", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "News division of the American broadcast television network NBC.",
            name: "NBC News"
        }
    },

    {
        rootUrl: "https://www.news.com.au/content-feeds/",
        uid: "newscomau",
        engine: "mercury",
        categories: [
            {name: "National News", feedUrl: "latest-news-national/", listable: true},
            {name: "World News", feedUrl: "latest-news-world/", listable: true},
            {name: "Lifestyle", feedUrl: "latest-news-lifestyle/", listable: true},
            {name: "Travel", feedUrl: "latest-news-travel/", listable: true},
            {name: "Entertainment", feedUrl: "latest-news-entertainment/", listable: true},
            {name: "Technology", feedUrl: "latest-news-technology/", listable: true},
            {name: "Sport", feedUrl: "latest-news-sport/", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An Australian news and entertainment website that specialises in breaking national and international news.",
            name: "News.com.au"
        }
    },

    {
        rootUrl: "https://indianexpress.com/section/",
        uid: "theIndianExpress",
        engine: "mercury",
        categories: [
            {name: "India News", feedUrl: "india/feed/", listable: true},
            {name: "World News", feedUrl: "world/feed/", listable: true},
            {name: "Lifestyle", feedUrl: "lifestyle/feed/", listable: true},
            {name: "Entertainment", feedUrl: "entertainment/feed/", listable: true},
            {name: "Opinion", feedUrl: "opinion/feed/", listable: true},
            {name: "Sports", feedUrl: "sports/feed/", listable: true},
            {name: "Technology", feedUrl: "technology/feed/", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An English-language Indian daily newspaper published in Mumbai.",
            name: "The Indian Express"
        }
    },

    {
        rootUrl: "https://slate.com/feeds/",
        uid: "slate",
        engine: "readability",
        categories: [
            {name: "All Stories", feedUrl: "all.rss", listable: true},
            {name: "News and Politics", feedUrl: "news-and-politics.rss", listable: true},
            {name: "Culture", feedUrl: "culture.rss", listable: true},
            {name: "Technology", feedUrl: "technology.rss", listable: true},
            {name: "Business", feedUrl: "business.rss", listable: true},
            {name: "Human Interest", feedUrl: "human-interest.rss", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "An online magazine that covers current affairs, politics, and culture in the United States.",
            name: "Slate"
        }
    },

    {
        rootUrl: "https://forward.com/",
        uid: "forward",
        engine: "readability",
        categories: [
            {name: "All Articles", feedUrl: "rss/", listable: true}
        ],
        descriptor: {
            language: "en",
            description: "An American news media organization for a Jewish-American audience.",
            name: "Forward"
        }
    },

    {
        rootUrl: "https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com&ceid=US:en&hl=en-US&gl=US",
        uid: "reuters",
        engine: "mercury",
        categories: [
            {name: "Top Stories", feedUrl: "reuters/topNews", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "International news organization founded in 1851.",
            name: "Reuters"
        }
    },

    {
        rootUrl: "https://www.chicagotribune.com/arcio/rss/category/",
        uid: "chicagoTribune",
        engine: "readability",
        categories: [
            {name: "Breaking News", feedUrl: "news/breaking/", listable: true},
            {name: "News", feedUrl: "news/", listable: true},
            {name: "Entertainment", feedUrl: "entertainment/", listable: true},
            {name: "Sports", feedUrl: "sports/", listable: true},
            {name: "Lifestyles", feedUrl: "lifestyles/", listable: true},
            {name: "Opinion", feedUrl: "opinion/", listable: true}
        ],
        descriptor: {
            language: "en",
            description: "A daily newspaper based in Chicago, USA, founded in 1847.",
            name: "Chicago Tribune"
        }
    },

    {
        rootUrl: "https://www.abc.net.au/news/feed/",
        uid: "abc",
        engine: "mercury",
        categories: [
            {name: "All content", feedUrl: "2942460/rss.xml", listable: true},
            {name: "ABC Rural", feedUrl: "4535882/rss.xml", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "Your home of Australian stories, conversations and events that shape our nation.",
            name: "ABC"
        }
    },

    {
        rootUrl: "https://www.cbsnews.com/latest/rss/",
        uid: "cbsNews",
        engine: "readability",
        categories: [
            {name: "Top Stories", feedUrl: "main", listable: true},
            {name: "U.S.", feedUrl: "us", listable: true},
            {name: "Politics", feedUrl: "politics", listable: true},
            {name: "World", feedUrl: "world", listable: true},
            {name: "Science", feedUrl: "science", listable: true},
            {name: "Health", feedUrl: "health", listable: true},
            {name: "Entertainment", feedUrl: "entertainment", listable: true},
            {name: "Technology", feedUrl: "technology", listable: true},
            {name: "Sunday Morning", feedUrl: "sunday-morning", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "The news division of the American television and radio service CBS.",
            name: "CBS News"
        }
    },

    {
        rootUrl: "https://thehill.com/",
        uid: "theHill",
        engine: "mercury",
        categories: [
            {name: "Top Stories", feedUrl: "rss/syndicator/19110", listable: true},
            {name: "All News", feedUrl: "rss/syndicator/19109", listable: true},
            {name: "Administration", feedUrl: "taxonomy/term/1132/feed", listable: true},
            {name: "Senate", feedUrl: "taxonomy/term/1130/feed", listable: true},
            {name: "House", feedUrl: "taxonomy/term/1131/feed", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "It is one of the largest independent political news site in the United States.",
            name: "The Hill"
        }

    },

    {
        rootUrl: "https://rss.politico.com/",
        uid: "politico",
        engine: "readability",
        categories: [
            {name: "Congress", feedUrl: "congress.xml", listable: true},
            {name: "Health Care", feedUrl: "healthcare.xml", listable: true},
            {name: "Defense", feedUrl: "defense.xml", listable: true},
            {name: "Economy", feedUrl: "economy.xml", listable: true},
            {name: "Energy & Environment", feedUrl: "energy.xml", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "Covers politics and policy in the United States and internationally.",
            name: "Politico"
        }
    },

    {
        rootUrl: "https://feeds.feedburner.com/",
        uid: "breitbart",
        engine: "readability",
        categories: [
            {name: "All articles", feedUrl: "breitbart", listable: true},
        ],
        descriptor: {
            language: "en",
            description: "Syndicated news and opinion website providing continuously updated headlines to top news and analysis sources.",
            name: "Breitbart"
        }
    },


];