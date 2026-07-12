import {Orchestrator} from "@voxmate/orc/orc";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {formatDuration} from "@voxmate/voxmate/utility/strings";
import voxmate, {
    Actor,
    Gesture,
    IVoxmatePromise,
    IYouTubeMultipartChannelResult,
    IYouTubeMultipartVideoResult,
    IYouTubeOperationStatus,
    IYouTubePlaybackResult,
    IYouTubeSubscriptionStatus,
    IYouTubeVideo
} from "@voxmate/voxmate";

const yt = voxmate.special.youtube;

interface IYoutubeRequest {
    type: "play-video",
    videoId?: string;
}

export interface IYouTubeBasicVideo extends IYouTubeVideo {
    views: number;
    duration: string;
}

class YoutubeNeedsSetup {
}

abstract class YoutubeBaseActivity extends RichActivity {

    private async wrapTubeApi<T>(task: IVoxmatePromise<T>): Promise<T> {
        try {
            return await this.wrap(task);
        } catch (e) {
            if (e == "setup") {
                throw new YoutubeNeedsSetup();
            }
            throw e;
        }
    }

    async youTubePlayVideo(videoId: string, continueFrom: number): Promise<IYouTubePlaybackResult> {
        //TODO: Add to watch history
        return await this.wrapTubeApi(yt.play(videoId, continueFrom));
    }

    async youTubeGetInfo(videoId: string): Promise<IYouTubeVideo> {
        return await this.wrapTubeApi(yt.info(videoId));
    }

    /*
        Enable this when we've settled with Youtube
     */
    async youTubeSearch(query: string): Promise<IYouTubeMultipartVideoResult> {
        return await this.wrapTubeApi(yt.search(query));
    }

    async youTubeBasicSearch(query: string): Promise<IYouTubeBasicVideo[]> {
        return await this.fhttp("voxlet_youtube", "search", {"query": query});
    }

    async youTubeSubscriptions(): Promise<IYouTubeMultipartChannelResult> {
        return await this.wrapTubeApi(yt.subscriptions());
    }

    async youTubeSubscribe(channelId: string): Promise<IYouTubeOperationStatus> {
        return await this.wrapTubeApi(yt.subscribe(channelId));
    }

    async youTubeUnSubscribe(subscriptionId: string): Promise<IYouTubeOperationStatus> {
        return await this.wrapTubeApi(yt.unsubscribe(subscriptionId));
    }

    async youTubeCheckSubscriptionStatus(channelId: string): Promise<IYouTubeSubscriptionStatus> {
        return await this.wrapTubeApi(yt.checkSubscription(channelId));
    }

    async youTubeGetChannelVideos(channelId: string): Promise<IYouTubeMultipartVideoResult> {
        return await this.wrapTubeApi(yt.getChannelVideos(channelId));
    }

    async youTubeGetRelatedVideos(videoId: string): Promise<IYouTubeMultipartVideoResult> {
        return await this.wrapTubeApi(yt.related(videoId));
    }
}

class YouTubeVideoPlayer extends YoutubeBaseActivity {
    constructor(private readonly video: IYouTubeVideo) {
        super();
    }

    protected async run(): Promise<void | any> {

        let continueFrom = 0;
        while (this.isActive) {
            const result = await this.youTubePlayVideo(this.video.videoId, continueFrom);

            if (!result.haveApp) {
                await this.sayInfo("Please install the official Youtube App from Google Play in order to play Youtube videos.");
                return;
            }

            if (result.error) {
                await this.sayInfo("Unable to start video playback");
                return;
            }

            if (result.info) {
                const continuePlaying = await this.options(result);
                if (continuePlaying == undefined) {
                    continueFrom = result.position;
                    continue;
                }
            }

            return;
        }
    }

    private async options(result: IYouTubePlaybackResult) {
        const dex = this.roll().setActor(Actor.DynamicInformational);

        dex.add("About this Video", async () => {
            const durationInMilliseconds = result.duration;
            const offsetInMilliseconds = result.position;

            await this.sayDynamicInfo(`You are watching - ${this.video.title} on ${this.video.channelTitle}`);
            await this.sayDynamicInfo(`This video is ${formatDuration(durationInMilliseconds)} long.`);
            await this.sayDynamicInfo(`You are currently at the ${formatDuration(offsetInMilliseconds)} mark.`);

            if (this.video.description) {
                const parts = voxmate.utility.splitIntoSentences(this.video.description);
                await this.readLong(parts, {title: "Video Description"});
            }
        });

        dex.add("Related Videos", async () => {
            const videos = await this.freeze(this.youTubeGetRelatedVideos(this.video.videoId));
            await this.exec(new YouTubeVideoListing(videos, null));
        });

        if (this.video.channelId != null) {
            dex.add("Channel Videos", async () => {
                const videos = await this.freeze(this.youTubeGetChannelVideos(this.video.channelId));
                await this.exec(new YouTubeVideoListing(videos, this.video.channelId));
            });

            const chan = this.video.channelTitle ?? "this channel";
            dex.add(`Subscribe to ${chan}`, async () => {
                await this.freeze(this.youTubeSubscribe(this.video.channelId));
                await this.sayInfo("Subscribed");
            });
        }

        return await dex.run();
    }
}

// class YouTubeChannelLister extends RichActivity { }

class YouTubeVideoListing extends YoutubeBaseActivity {

    private subscribed: boolean = false;

    constructor(private readonly videos: IYouTubeMultipartVideoResult,
                private readonly channelId: string | null) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        if (this.channelId) {
            this.subscribed = (await this.youTubeCheckSubscriptionStatus(this.channelId)).exists;
        }
    }

    protected async run(): Promise<void | any> {

        if (this.videos.videos.length == 0) {
            await this.sayDynamicContent("Nothing to see here");
            return;
        }

        const dex = this.roll();

        for (let video of this.videos.videos) {
            dex.add(async () => {
                await this.sayDynamicContent(video.title);
                if (this.channelId == null)
                    await this.sayDynamicInfo(`From - ${video.channelTitle}`);
            }, async () => {
                await this.exec(new YouTubeVideoPlayer(video));
            });
        }

        const video = this.videos.videos[0];
        const channelTitle = video.channelTitle ?? "this channel";

        dex.add(async () => {
            if (!this.subscribed) {
                await this.sayDynamicInfo(`Subscribe to ${channelTitle}`);
            } else {
                await this.sayDynamicInfo(`Unsubscribe from ${channelTitle}`);
            }
        }, async () => {
            if (!this.subscribed) {
                await this.freeze(this.youTubeSubscribe(video.channelId));
            } else {
                const subscription = await this.youTubeCheckSubscriptionStatus(this.channelId);
                if (subscription.exists)
                    await this.freeze(this.youTubeUnSubscribe(subscription.subscriptionId));
            }
            this.subscribed = !this.subscribed;
            await this.sayInfo(this.subscribed ? "Subscribed" : "Unsubscribed");
        });


        return dex.run();
    }
}

class YouTubeChannelListing extends YoutubeBaseActivity {
    constructor(private readonly listing: IYouTubeMultipartChannelResult) {
        super();
    }

    protected async run(): Promise<void | any> {

        if (this.listing.channels.length == 0) {
            await this.sayInfo("You don't have any subscriptions yet");
            return;
        }

        const dex = this.roll();
        for (let item of this.listing.channels) {
            dex.add(async () => {
                await this.sayDynamicInfo(item.title);
                const parts = voxmate.utility.splitIntoSentences(item.description);
                for (let part of parts)
                    await this.sayDynamicContent(part);
            }, async () => {
                const videos = await this.freeze(this.youTubeGetChannelVideos(item.channelId));
                await this.exec(new YouTubeVideoListing(videos, item.channelId));
            });
        }
        return dex.run();
    }
}

class YoutubeMainMenu extends YoutubeBaseActivity {
    protected async run(): Promise<void | any> {
        const dex = this.roll();

        dex.add("Search", async () => {
            const query = await this.editField(undefined, {maxLength: 100});
            if (query) {
                const videos = await this.freeze(this.youTubeBasicSearch(query));
                const listing: IYouTubeMultipartVideoResult = {
                    next: "", videos: videos
                };
                await this.exec(new YouTubeVideoListing(listing, null));
            }
        });

        dex.add("My Subscriptions", async () => {
            const subs = await this.freeze(this.youTubeSubscriptions());
            await this.exec(new YouTubeChannelListing(subs));
        });

        dex.add("YouTube Privacy Policy", async () => {
            await this.openURL("https://www.youtube.com/t/terms");
        });

        dex.add("Google Privacy Policy", async () => {
            await this.openURL("https://policies.google.com/privacy");
        });

        return dex.run();
    }
}

class YouTubeSetupMenu extends YoutubeBaseActivity {
    protected async run(): Promise<void | any> {

        //TODO: (X-OAUTH) Remove this Guard

        // await this.sayInfo("We are waiting for approval from Google to enable some Youtube features. Stay tuned.");

        await this.sayInfo("In order to use Voxmate with YouTube on your device, you must select your Google Account and grant Voxmate necessary permissions.");
        await this.sayInfo("The system will visually show one or more prompts, and will require input.");

        while (this.isActive) {

            let input = await this.sayInfo("Swipe right to continue.");
            input = input ?? await this.get();

            if (input.kind == "gesture") {
                if (input.gesture == Gesture.Right) {
                    const result = await this.wrap(yt.setup());
                    if (result.ok) {
                        await this.sayInfo("Your account was setup successfully.");
                        break;
                    } else {
                        await this.sayInfo("Something went wrong setting up your account.");
                    }
                }
            }
        }
    }
}

export async function main(request?: IYoutubeRequest) {
    try {
        if (request) {
            if (request.type == "play-video") {
                await new Orchestrator()
                    .start(class extends YoutubeBaseActivity {

                        private video: IYouTubeVideo;

                        protected async init(): Promise<void> {
                            await super.init();
                            this.video = await this.youTubeGetInfo(request.videoId);
                        }

                        protected async run(): Promise<void | any> {
                            const player = new YouTubeVideoPlayer(this.video);
                            return await this.exec(player);
                        }
                    });
            }
        } else {
            await new Orchestrator()
                .start(YoutubeMainMenu);
        }
    } catch (e) {
        if (e instanceof YoutubeNeedsSetup) {
            await new Orchestrator()
                .start(YouTubeSetupMenu);
        } else throw e;
    }
}