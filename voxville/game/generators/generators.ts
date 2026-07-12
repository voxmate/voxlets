import {TileKind} from '../types';
import {biasedChoice, randomChoice} from "@voxmate/voxmate/utility/random";
import {capitalizeString} from "@voxmate/voxmate/utility/strings";


function randomNoise() {
    const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
    const names5 = ['b', 'br', 'bl', 'c', 'cl', 'cr', 'd', 'dr', 'f', 'fr', 'fl', 'g', 'gr', 'gl', 'gn', 'h', 'j', 'k', 'kr', 'kl', 'kn', 'm', 'n', 'p',
        'pr', 'pl', 'q', 'qr', 'ql', 'r', 's', 'st', 'sr', 'str', 'sl', 't', 'tr', 'tl', 'v', 'vl', 'vr', 'w', 'wr', 'x', 'z', '', '', '', '', ''];
    const names7 = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z', '', '', '', '', '', ''];
    const names9 = ['b', 'd', 'g', 'gh', 'h', 'hr', 'hs', 'ht', 'hst', 'hsh', 'hn', 'hm', 'hl', 'hz', 'hx', 'hq', 'k', 'ks', 'kx', 'l', 'll', 'lk', 'ln',
        'lm', 'lz', 'lp', 'lt', 'ls', 'lst', 'lf', 'm', 'mn', 'mm', 'mt', 'ms', 'n', 'nn', 'nt', 'ns', 'p', 'ps', 'pt', 'ph', 'q', 'r', 'rs', 'rt',
        'rst', 'rq', 'rk', 'rc', 'rf', 'rb', 'rd', 's', 'st', 'ss', 'sh', 'sk', 'sp', 't', 'th', 'ts', 'w', 'wth', 'x', 'z'];

    return capitalizeString(randomChoice(names5)) + randomChoice(vowels) + randomChoice(names7) + randomChoice(vowels) + randomChoice(names9);
}

function join(...params: (string[] | string)[]) {
    const parts = [];
    for (let param of params) {
        if (param instanceof Array) {
            parts.push(randomChoice(param));
        } else {
            parts.push(param);
        }
    }
    return parts.join(' ');
}

function generateGrasslandsRegionName() {

    const names1 = ['White', 'Black', 'Brown', 'Gray', 'Pygmy', 'Greater', 'Lesser',
        'Masked', 'Common', 'Prairie', 'Alpine', 'Collared', 'Grand',
        'Spotted', 'Speckled', 'Striped', 'Dotted', 'Rusty', 'Maned', 'Cloudy', 'Crowned', 'Golden', 'Noble',
        'Banded', 'Snowy', 'Ivory', 'Ebony', 'Wild', 'Regal'];

    const names2 = ['Alpaca', 'Anaconda', 'Ant', 'Anteater', 'Antelope', 'Armadillo', 'Baboon', 'Badger', 'Bandicoot', 'Bat', 'Bear', 'Bee', 'Beetle',
        'Bird', 'Bison', 'Boa', 'Buffalo', 'Butterfly', 'Buzzard', 'Caterpillar', 'Chipmunk', 'Cobra', 'Cougar', 'Coyote', 'Crane', 'Cricket', 'Crow',
        'Deer', 'Dingo', 'Dove', 'Duck', 'Eagle', 'Elephant', 'Elk', 'Fox', 'Frog', 'Gazelle', 'Grasshopper', 'Groundhog', 'Hawk', 'Hedgehog', 'Hyena',
        'Jackal', 'Kangaroo', 'Ladybug', 'Lion', 'Meerkat', 'Mouse', 'Rabbit', 'Rat', 'Raven', 'Rhino', 'Snake', 'Toad', 'Tortoise', 'Warthog', 'Wasp',
        'Weasel', 'Wild Dog'];

    const names3 = ['Grasslands', 'Grassland', 'Savanna', 'Pastures', 'Range', 'Fields', 'Meadow', 'Gardens', 'Valley', 'Hinterland'];

    const names4 = ['Big', 'Blooming', 'Blossoming', 'Calm', 'Colossal', 'Curious', 'Deep', 'Detailed', 'Dramatic', 'Earthy',
        'Enchanted', 'Faint', 'Gentle', 'Giant', 'Glistening', 'Green', 'Groovy', 'Healthy', 'Heavenly', 'High',
        'Hissing', 'Hollow', 'Incredible', 'Jaded', 'Jagged', 'Light', 'Lively', 'Lonely', 'Luscious', 'Lush', 'Magical', 'Magnificent', 'Majestic', 'Mammoth', 'Marvelous',
        'Massive', 'Mellow', 'Mighty', 'Misty', 'Moldy', 'Mysterious', 'Narrow', 'Old', 'Panoramic', 'Parallel', 'Peaceful', 'Quiet', 'Rainy', 'Reflecting',
        'Round', 'Royal', 'Sacred', 'Scattered', 'Secret', 'Shimmering', 'Simple', 'Spectacular', 'Spiritual', 'Stormy', 'Teeny',
        'Thick', 'Thin', 'Thundering', 'Tiny', 'Violent', 'Violet', 'Wandering', 'Whispering', 'Wicked', 'Wild', 'Windy', 'Young'];


    const choice = biasedChoice({
        'complexName': 10,
        'simpleName': 20,
        'randomName': 5
    });

    if (choice === 'complexName') {
        return `${randomChoice(names1)} ${randomChoice(names2)} ${randomChoice(names3)}`;
    }

    if (choice === 'simpleName') {
        return `${randomChoice(names4)} ${randomChoice(names3)}`;
    }

    return `${randomNoise()} ${randomChoice(names3)}`;
}

function generateMountainsRegionName() {

    const names1 = ['Adamantine', 'Ancient', 'Angry', 'Arctic', 'Bare', 'Barren', 'Beholding', 'Bellowing', 'Black',
        'Bronze', 'Burning', 'Calm', 'Charmed', 'Cold', 'Colossal', 'Dangerous', 'Dark', 'Desolate',
        'Distant', 'Enchanted', 'Enormous', 'Eroded', 'Ethereal', 'Ever Reaching',
        'Everlasting', 'Fabled', 'Faraway', 'Feared', 'Fearsome', 'Flaring', 'Forbidden', 'Fractured', 'Frightening',
        'Frozen', 'Gargantuan', 'Giant', 'Gloomy', 'Gray', 'Grim', 'Heaven-reaching', 'Hollow',
        'Hopeless', 'Hungry', 'Ice-crowned', 'Immense', 'Infernal', 'Isolated', 'Jagged',
        'Light', 'Lightest', 'Lonely', 'Mammoth', 'Mighty', 'Mirrored', 'Misty', 'Moaning', 'Monstrous',
        'Moonlit', 'Motionless', 'Mysterious', 'Naked', 'Narrow', 'Neverending', 'New', 'Overhanging', 'Prickly',
        'Quiet', 'Raging', 'Red', 'Relentless', 'Remote', 'Restless', 'Rocky', 'Round-topped', 'Rugged', 'Sad', 'Savage', 'Scarlet',
        'Severed', 'Shadowed', 'Shadowy', 'Sharp-peaked', 'Shimmering', 'Slumbering', 'Snowy', 'Steep', 'Symmetrical',
        'Thundering', 'Titanic', 'Towering', 'Unresting', 'Unscaled', 'Unwelcoming', 'Vast', 'Violent', 'Voiceless',
        'Volcanic', 'Whispering', 'White', 'Windless', 'Windy', 'Wintry', 'Withered', 'Yelling'];

    const names2 = ['Bluff', 'Heights', 'Highland', 'Highlands', 'Hill', 'Hills', 'Hillside', 'Mountain', 'Mountains', 'Peaks',
        'Pinnacle', 'Rise', 'Slopes', 'Summit', 'Tips', 'Tops', 'Volcano'];

    const choice = biasedChoice({
        'simpleName': 20,
        'randomName': 5
    });


    if (choice === 'simpleName') {
        return `${randomChoice(names1)} ${randomChoice(names2)}`;
    }

    return `${randomNoise()} ${randomChoice(names2)}`;
}

function generateForestsRegionName() {

    const nm1 = ['White', 'Black', 'Brown', 'Gray', 'Majestic', 'Pygmy', 'Little', 'Giant',
        'Greater', 'Lesser', 'Masked', 'Common', 'Prairie',
        'Alpine', 'Collared', 'Grand', 'Spotted', 'Speckled', 'Striped', 'Dotted',
        'Rusty', 'Maned', 'Cloud', 'Long-tailed', 'Short-tailed', 'Crowned', 'Golden', 'Imperial', 'Royal', 'Noble', 'Laughing',
        'Lined', 'Banded', 'Snow', 'Ivory', 'Ebony', 'Wild', 'Regal'];

    const nm2 = ['Panda', 'Gerbil', 'Hare', 'Hedgehog', 'Jackal', 'Warthog', 'Coyote', 'Cat', 'Badger', 'Hyena', 'Jaguar', '' +
    'Gorilla', 'Sloth', 'Anteater', 'Ocelot', 'Lion', 'Porcupine', 'Beaver', 'Otter', 'Ant', 'Bandicoot', 'Crocodile', 'Alligator',
        'Treefrog', 'Wolverine', 'Goat', 'Spider', 'Mouse', 'Snail', 'Crab', 'Deer', 'Fox', 'Lizard', 'Toad', 'Mole', 'Turtle', 'Frog',
        'Squirrel', 'Tortoise', 'Gazelle', 'Panther', 'Bear', 'Rat', 'Lynx', 'Okapi', 'Leopard', 'Tiger', 'Wolf', 'Rhino', 'Wallaby', 'Yak',
        'Pelican', 'Swallow', 'Duck', 'Eagle', 'Hawk', 'Falcon', 'Vulture', 'Sunbird', 'Macaw', 'Woodpecker', 'Kingfisher', 'Hummingbird',
        'Pygmy Owl', 'Sandpiper', 'Mockingbird'];

    const nm3 = ['Grove', 'Woods', 'Covert', 'Forest', 'Woodland', 'Wilds', 'Wood'];

    const nm4 = ['Calm', 'Sacred', 'Massive', 'Teeny', 'Tiny', 'Puny', 'Mammoth', 'Gigantic', 'Colossal',
        'Big', 'Faint', 'Hissing', 'Quiet', 'Thundering', 'Whispering', 'Beautiful', 'Fancy', 'Magnificent', 'Mysterious',
        'Old', 'Broken', 'Creepy', 'Abandoned', 'Light', 'Earthy', 'Elegent', 'Deep', 'Enchanted', 'Detailed', 'Deserted',
        'Exclusive', 'Dramatic', 'Curious', 'Awesome', 'Jaded', 'Jagged', 'Incredible', 'Healthy', 'Heavenly', 'High',
        'Hollow', 'Gentle', 'Giant', 'Glistening', 'Glorious', 'Gorgeous', 'Groovy', 'Free', 'Frightened', 'Frightening',
        'Little', 'Lively', 'Lonely', 'Lush', 'Magical', 'Majestic', 'Marvelous', 'Mellow', 'Mighty', 'Misty', 'Moldy', 'Narrow',
        'Oceanic', 'Quiet', 'Panoramic', 'Parallel', 'Peaceful', 'Plain', 'Pleasant', 'Precious', 'Private', 'Rainy', 'Reflecting',
        'Romantic', 'Rotten', 'Royal', 'Terrible', 'Terrific', 'Thick', 'Thin', 'Threatening', 'Towering', 'Scattered', 'Secret',
        'Sickly', 'Dark', 'Shadow', 'Simple', 'Special', 'Spectacular', 'Spiritual', 'Square', 'Round', 'Triangular', 'Stormy', 'Young',
        'Wandering', 'Whimsical', 'Wicked', 'Wild', 'Windy', 'Wise', 'Wretched', 'Venomous', 'Violent', 'Violet', 'Unknown', 'Alien'];

    const nm5 = ['Jolly', 'Broad', 'Brass', 'Copper', 'Golden', 'Silver', 'Bronze', 'Massive', 'Teeny', 'Tiny', 'Puny',
        'Mammoth', 'Gigantic', 'Colossal', 'Big', 'Quiet', 'Thundering', 'Whispering', 'Ancient', 'Beautiful', 'Fancy',
        'Magnificent', 'Mysterious', 'Old', 'Short', 'Heavy', 'Light', 'Elegent', 'Enchanted', 'Exclusive', 'Exotic', 'Dramatic',
        'Curious', 'Aromatic', 'Awesome', 'Imaginary', 'Incredible', 'Healthy', 'Heavenly', 'Hollow', 'Hypnotic', 'Gentle',
        'Giant', 'Glistening', 'Glorious', 'Goofy', 'Gorgeous', 'Greasy', 'Groovy', 'Gruesome', 'Fabulous', 'Faded', 'False', 'Familiar',
        'Fancy', 'Fantastic', 'Fascinating', 'Foolish', 'Fragile', 'Free', 'Frightened', 'Frightening', 'Last', 'Little', 'Lonely', 'Lush',
        'Magical', 'Majestic', 'Mellow', 'Mighty', 'Misty', 'Minor', 'Misty', 'Moldy', 'Naive', 'Narrow', 'Nonstalgic', 'Quiet', 'Peaceful',
        'Plain', 'Pleasant', 'Precious', 'Private', 'Rare', 'Regular', 'Reflecting', 'Royal', 'Tall', 'Terrific', 'Thick', 'Thin', 'Threatening',
        'Tired', 'Towering', 'Scattered', 'Secret', 'Shaggy', 'Sickly', 'Simple', 'Sleepy', 'Special', 'Spectacular', 'Spotless', 'Spotted',
        'Stormy', 'Young', 'Waiting', 'Wandering', 'Whimsical', 'Wicked', 'Wild', 'Windy', 'Wise', 'Wretched', 'Violet', 'Unique', 'Unknown',
        'Unnatural', 'Alien'];

    const nm6 = ['Alder', 'Ash', 'Ash', 'Ash', 'Beech', 'Birch', 'Birch', 'Birch', 'Bladdernut', 'Buckeye', 'Cedar', 'Chestnut', 'Cypress',
        'Devilwood', 'Dogwood', 'Elderberry', 'Elm', 'Fir', 'Harlequin', 'Hemlock', 'Hickory', 'Holly', 'Ironwood', 'Jacktree', 'Juniper',
        'Linden', 'Locust', 'Magnolia', 'Maple', 'Maple', 'Maple', 'Maple', 'Musclewood', 'Oak', 'Oak', 'Oak', 'Oak', 'Olive', 'Palm', 'Pawpaw',
        'Peach', 'Pine', 'Pine', 'Pine', 'Pine', 'Apple', 'Raspberry', 'Plum', 'Poplar', 'Redbud', 'Redwood', 'Redwood', 'Silverbell', 'Spruce',
        'Spruce', 'Spruce', 'Spruce', 'Sumac', 'Tupelo', 'Walnut', 'Willow', 'Willow', 'Willow', 'Willow', 'Hazulnut', 'Blueberry', 'Chestnut',
        'Blackberry', 'Butternut', 'Pecan', 'River', 'Lake', 'Wetland', 'Stream', 'Creek', 'Brook', 'Rivulet', 'Basin', 'Lagoon', 'Loch', 'Pond',
        'Spring', 'Reservoir', 'Basin', 'Marsh', 'Quagmire', 'Swampland', 'Bog', 'Clearing', 'Glade', 'Field', 'Hill', 'Garden', 'Range', 'Territory',
        'Meadow', 'Mead', 'Grassland', 'Bluff', 'Cliff', 'Highland', 'Knoll', 'Mound', 'Mount', 'Thorn'];


    const choice = biasedChoice({
        'complexName': 10,
        'simpleName': 20,
        'descriptiveName': 10,
        'randomName': 5
    });

    if (choice === 'complexName') {
        return join(nm5, nm6, nm3);
    }

    if (choice === 'simpleName') {
        return join(nm4, nm3);
    }

    if (choice === 'descriptiveName') {
        return join(nm1, nm2, nm3);
    }

    return join(randomNoise(), nm3);
}

function generateWatersRegionName() {

    const nm1 = ['Abysmal', 'Arching', 'Red', 'Black', 'White', 'Cursed', 'Frozen', 'Arctic', 'Barren', 'Billowy', 'Bland',
        'Blue', 'Boiling', 'Boisterous', 'Bottomless', 'Boundless', 'Brilliant', 'Bursting',
        'Calm', 'Calmest', 'Charmed', 'Cheerless', 'Choral', 'Circumfluous', 'Climbing', 'Cobalt', 'Cold',
        'Coral', 'Crystal', 'Dancing', 'Dread', 'Dreaded', 'Dark', 'Darkest', 'Dead', 'Deep', 'Deepest', 'Delicious',
        'Dense', 'Distant', 'Emerald', 'Empty', 'Enchanted', 'Ethereal', 'Fair',
        'Farthest', 'Flat', 'Forbidden', 'Quiet', 'Flowing', 'Foaming', 'Frothy', 'Glassy', 'Gleaming', 'Glistening', 'Grave',
        'Gray', 'Green', 'Harmonious', 'Heartless', 'Heaving', 'Homeless', 'Hungry', 'Infernal', 'Infinite', 'Invisible', 'Isolated',
        'Jade', 'Laughing', 'Lifeless', 'Living', 'Lonely', 'Lucent', 'Majestic', 'Mesmerizing', 'Mighty', 'Misty', 'Moaning', 'Molten',
        'Moon-lit', 'Motionless', 'Narrow', 'Neglected', 'Orient', 'Peaceful', 'Perfumed', 'Pleasant', 'Primeval', 'Raging',
        'Rainy', 'Rippling', 'Rocking', 'Rolling', 'Rough', 'Rushing', 'Sandy', 'Sanguine', 'Savage', 'Serene', 'Shimmering', 'Shoaling',
        'Shoreless', 'Sleeping', 'Slumbrous', 'Soundless', 'Spacious', 'Sparkling', 'Sterile', 'Stern', 'Straitened', 'Sunny',
        'Surging', 'Teal', 'Terrestrial', 'Throbbing', 'Thundering', 'Tideless', 'Tinted', 'Tossing', 'Tranquil', 'Treacherous',
        'Triumphant', 'Mirrored', 'Restless', 'Tropic', 'Troubled', 'Turbulent', 'Turquoise', 'Ugly', 'Ultramarine', 'Uncanny',
        'Unfathomed', 'Unknown', 'Unresting', 'Unruffled', 'Unstable', 'Vast', 'Violent', 'Walled', 'Wasted', 'Wasteful', 'Wasting',
        'Waveless', 'Whelming', 'Whispering', 'Wild', 'Windy', 'Wondering', 'Wrinkled', 'Yearning'];

    const nm2 = ['Abyss', 'Tides', 'Waves', 'Bay', 'Deep', 'Depths', 'Expanse', 'Gulf', 'Ocean', 'Sea', 'Waters'];

    const choice = biasedChoice({
        'simpleName': 10,
        'randomName': 1
    });

    if (choice === 'simpleName') {
        return join(nm1, nm2);
    }

    return join(randomNoise(), nm2);
}

function generatePlainsRegionName() {

    const nm1 = ['Naked', 'Arctic', 'Bare',
        'Black', 'Bleak', 'Burned', 'Burning', 'Calm',
        'Charmed', 'Cunning', 'Dangerous', 'Dark', 'Darkest',
        'Deserted', 'Desolate',
        'Distant', 'Dreadful', 'Dreary',
        'Enchanted', 'Ethereal', 'Ever Reaching', 'Everlasting',
        'Fiery', 'Flat', 'Forbidden', 'Forbidding', 'Frozen', 'Grave', 'Grim',
        'Hellish', 'Hopeless', 'Hot', 'Hungry', 'Infernal', 'Infinite', 'Isolated',
        'Light', 'Lightest', 'Lonely', 'Malevolent', 'Malicious',
        'Mighty', 'Misty', 'Moaning', 'Monotonous', 'Motionless', 'Mysterious', 'Narrow',
        'Neverending', 'Open', 'Painful', 'Parched', 'Quiet', 'Raging', 'Red',
        'Restless', 'Rocky', 'Sad', 'Sandy', 'Sanguine', 'Savage', 'Scorching', 'Shadowed',
        'Silent', 'Sly', 'Shimmering', 'Soundless', 'Sterile', 'Thundering', 'Treacherous', 'Twisting',
        'Uncanny', 'Unresting', 'Vast', 'Violent',
        'Voiceless', 'Whispering', 'White', 'Windy', 'Withered', 'Yelling', 'Yellow'];

    const nm2 = ['Flatlands', 'Barrens', 'Borderlands', 'Desert', 'Expanse',
        'Prairie', 'Steppes', 'Tundra', 'Flats',
        'Wasteland', 'Wastes', 'Emptyness', 'Flatlands'];

    const choice = biasedChoice({
        'simpleName': 10,
        'randomName': 1
    });

    if (choice === 'simpleName') {
        return join(nm1, nm2);
    }

    return join(randomNoise(), nm2);
}

export function generateRegionName(kind: TileKind): string {

    if (kind === 'mountains') {
        return generateMountainsRegionName();
    }

    if (kind === 'grasslands') {
        return generateGrasslandsRegionName();
    }

    if (kind === 'forests') {
        return generateForestsRegionName();
    }
    if (kind === 'waters') {
        return generateWatersRegionName();
    }

    if (kind === 'plains') {
        return generatePlainsRegionName();
    }

    return 'TODO';
}

export function generateBuildingNamePrefix() {

    const prefixes = ['Alpha', 'Alpine', 'Altar', 'Angel', 'Angel Wings', 'Anomaly', 'Aqua', 'Aquamarine', 'Arachnid',
        'Arrowtip', 'Astro', 'Aurora', 'Avalanche', 'Azure', 'Bandana', 'Bear Paw', 'Black Crow', 'Blue Banner',
        'Boulderfist', 'Braveheart', 'Brown Bear', 'Bullet', 'Bullettooth', 'Bumblebee', 'Butterfly', 'Cannonball',
        'Castaway', 'Comet', 'Coyote', 'Crescent Moon', 'Crimson', 'Crossbow', 'Daemon', 'Darkwind', 'Dawn', 'Daybreak',
        'Daylight', 'Demon', 'Diamond', 'Dragonfire', 'Dragonfly', 'Dragontooth', 'Dusk', 'Eagle Eye', 'Ebony', 'Echo',
        'Eclipse', 'Effigy', 'Emerald', 'Energy', 'Enigma', 'Eventide', 'Fable', 'Falcon', 'Fallen Oak', 'Firefly', 'Frozen Lake',
        'Full Moon', 'Gadget', 'Gemini', 'Gizmo', 'Glacier', 'Grasshopper', 'Heartbreak', 'Heartfire', 'High Tide', 'Highlands',
        'Howling Wolf', 'Hummingbird', 'Hurricane', 'Ivory', 'Jadefire', 'Jasmine', 'Jester', 'Kite Shield', 'Light Beacon',
        'Lightning', 'Lightning Strike', 'Lion Roar', 'Lockdown', 'Lockheart', 'Lone Wolf', 'Maggot', 'Major', 'Malachite',
        'Maple Leaf', 'Maverick', 'Merlin', 'Midnight', 'Minor', 'Mirage', 'Mirror Image', 'Monsoon', 'Moonstone', 'Morningstar',
        'Mountain Peak', 'Nemo', 'New Moon', 'Night Beacon', 'Night Owl', 'Nightfall', 'Nighttide', 'Omega', 'Open Door', 'Overlook',
        'Pedestal', 'Phantasm', 'Phoenix', 'Quicksilver', 'Rabbit\'s Foot', 'Radiance', 'Raindrop', 'Red Banner', 'Saffron',
        'Sapphire', 'Satellite', 'Scarlet', 'Serpent', 'Shark Fin', 'Shooting Star', 'Silver Lining', 'Silver Shadow', 'Snowflake',
        'Solar Beam', 'Solar Flare', 'Solstice', 'Stardust', 'Starfall', 'Starlight', 'Stormgaze', 'Straight Arrow', 'Sundance',
        'Sundown', 'Sunset', 'Sunshine', 'Thunderclap', 'Thunderstorm', 'Tiger Claw', 'Tiger Lilly', 'Torchbearer', 'Tortoise',
        'Turtle Shell', 'Twilight', 'Viper', 'Waterfall', 'Whisper', 'Wild Card', 'Wild Horse', 'Willow', 'Woodpecker'];

    return randomChoice(prefixes);
}
