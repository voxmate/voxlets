import {PodcastDataService} from "../services/podcastDataService";
import {DeepMenuActivity, IMenuItem} from "@voxmate/orc/DeepMenu";
import {BrowseTopPodcastsActivity} from "./BrowseTopPodcastsActivity";


interface ICategoryDescriptor {
    name: string;
    id: number;
    subs: { [name: string]: number };
}

export class BrowsePodcastCategoriesActivity extends DeepMenuActivity<String> {
    dataService: PodcastDataService;

    async handle(item: String): Promise<void> {
        return undefined;
    }

    async menu() {

        //Mappings are from https://affiliate.itunes.apple.com/resources/documentation/genre-mapping/
        const categories: ICategoryDescriptor[] = [
            {
                name: "Arts",
                id: 1301,
                subs: {
                    "Food": 1306,
                    "Literature": 1401,
                    "Design": 1402,
                    "Performing Arts": 1405,
                    "Visual Arts": 1406,
                    "Fashion  and Beauty": 1459
                }
            },
            {
                name: "Comedy",
                id: 1303,
                subs: {}
            }, {
                name: "Kids and Family",
                id: 1305,
                subs: {}
            }, {
                name: "TV and Film",
                id: 1309,
                subs: {}
            }, {
                name: "Music",
                id: 1310,
                subs: {}
            }, {
                name: "News and Politics",
                id: 1311,
                subs: {}
            },
            {
                name: "Education",
                id: 1304,
                subs: {
                    "K-12": 1415,
                    "Higher Education": 1416,
                    "Educational Technology": 1468,
                    "Language Courses": 1469,
                    "Training": 1470
                }
            },
            {
                name: "Health",
                id: 1307,
                subs: {
                    "Fitness and Nutrition": 1417,
                    "Self-Help": 1420,
                    "Sexuality": 1421,
                    "Alternative Health": 1481
                }
            },
            {
                name: "Religion and Spirituality",
                id: 1314,
                subs: {
                    "Buddhism": 1438,
                    "Christianity": 1439,
                    "Islam": 1440,
                    "Judaism": 1441,
                    "Spirituality": 1444,
                    "Hinduism": 1463,
                    "Other": 1464,
                }
            },
            {
                name: "Science and Medicine",
                id: 1315,
                subs: {
                    "Natural Sciences": 1477,
                    "Medicine": 1478,
                    "Social Sciences": 1479,
                }
            },
            {
                name: "Sports and Recreation",
                id: 1316,
                subs: {
                    "Outdoor": 1456,
                    "Professional": 1465,
                    "Colledge and High School": 1466,
                    "Amature": 1467
                }
            }, {
                name: "Technology",
                id: 1318,
                subs: {
                    "Gadges": 1446,
                    "Tech News": 1448,
                    "Podcasting": 1450,
                    "Software How-to": 1480
                }
            }, {
                name: "Business",
                id: 1321,
                subs: {
                    "Careers": 1410,
                    "Investing": 1412,
                    "Management and Marketing": 1413,
                    "Business News": 1471,
                    "Shopping": 1472,
                }
            }, {
                name: "Games and Hobbies",
                id: 1323,
                subs: {
                    "Video Games": 1404,
                    "Automotive": 1454,
                    "Aviation": 1455,
                    "Hobbies": 1460,
                    "Other Games": 1461,
                }
            }, {
                name: "Society and Culture",
                id: 1324,
                subs: {
                    "Personal Journals": 1302,
                    "Places and Travel": 1320,
                    "Philosophy": 1443,
                    "History": 1462,
                }
            }, {
                name: "Government and Ogranizations",
                id: 1325,
                subs: {
                    "National": 1473,
                    "Regional": 1474,
                    "Local": 1475,
                    "Non-Profit": 1476,
                }
            }
        ];

        const menu: IMenuItem<String>[] = [];

        for (let cat of categories) {
            const subsub: IMenuItem<String>[] = [];

            if (Object.keys(cat.subs).length > 0) {
                subsub.push({
                    name: `All podcasts in ${cat.name}`,
                    activity: BrowseTopPodcastsActivity,
                    parameters: [cat.id]
                });

                for (let key in cat.subs) {
                    subsub.push({
                        name: key,
                        activity: BrowseTopPodcastsActivity,
                        parameters: [cat.subs[key]]
                    })
                }

                menu.push({
                    name: cat.name,
                    submenu: subsub
                });
            } else {
                menu.push({
                    name: cat.name,
                    activity: BrowseTopPodcastsActivity,
                    parameters: [cat.id]
                })
            }
        }

        return menu;
    }
}