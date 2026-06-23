export enum Gesture {
    Up = 0,
    Down = 1,
    Left = 2,
    Right = 3,

    Check = 4, //V-sign
    Hat = 5, //Hat-sign

    CircleClockwise = 7,
    DoubleTap = 8,

    DoubleUp = 9,
    DoubleDown = 10,
    DoubleLeft = 11,
    DoubleRight = 12,

    Poke = 100,         // useful to re-trigger menu options
}

export enum VoiceInputMode {
    NoInput = 0,
    CommandInput = 1,
    RecordInput = 2,
    DictationInput = 3
}

export enum Sound {
    // noinspection JSUnusedGlobalSymbols
    StopSounds = 0,
    Loading = 1,
    NoUpdates = 2,
    LoseFocus = 7,
    GainFocus = 8,
    Separator = 10,
    Announcement = 11,
    Marker = 12,
    Ping = 13,
    EndContent = 14,
    SoftClick = 15,
    Empty = 16,
    Good = 17,
    Bad = 18,
    Warning = 19,
    Marker2 = 20,
    LiveTile = 21,
    MessageNotification = 22,
    Tick = 23,
    TickFast = 24,
    ConnectionUp = 25,
    ConnectionDown = 26,
    MessageReceived = 27,
    MessageReceivedBackground = 28,
    MessageSent = 29,
    KeyPress = 30,
    Open = 31,
    Close = 32,
    ExpandHint = 33,
    Expand = 34,
    Hint = 35,

    Error = -1
}

export enum HapticSignal {
    // noinspection JSUnusedGlobalSymbols
    Tick = 0,
    NothingHere = 1
}

export enum Actor {
    Informational = 0,
    Content = 1,
    DynamicContent = 2,
    DynamicInformational = 3
}

export type Language = "en" | "et" | "ru" | "es" | "fr";

export const
    EN: Language = "en",
    ET: Language = "et",
    RU: Language = "ru",
    ES: Language = "es",
    FR: Language = "fr";

export const SUPPORTED_LANGUAGES: { [key in Language]: string } = {
    [EN]: "English",
    [RU]: "Russian",
    [ET]: "Estonian",
    [ES]: "Spanish",
    [FR]: "French"
};

export interface IAudioResult {
    interrupted: boolean;
    interruptionInput: UserInput | null;
}

// @ts-ignore

export interface IVoxmatePromise<T> extends Promise<T> {
    cancel(): void;
}

export interface IVoxletExecutionResult {
    timeTaken: number;
    code: number;
    data?: any;
}

export interface IResource {

    content: string | null;     // Utf-8 Decoded Response

    // Content decodes as valid json
    isValidJson: boolean;

    // Associated mime-type. Might not be set correctly.
    contentType: string;

    headers: { [name: string]: string[] };
}

export interface IHttpResult extends IResource {
    ok: boolean;
    code: number; // Time in milliseconds for the request
    time: number; // Time in milliseconds for the request
}

export interface ISpeechOptions {
    actor?: Actor;
    language?: string;
    voiceId?: string;
    speed?: number;

    // If channel is provided, the speech goes to background, and is interrupted only by speaking on same channel
    channel?: string;

    visuallyHidden?: boolean;
    demo?: boolean;
    showText?: string;
    autoDetectLanguage?: boolean;
    languageContext?: string[];
}

export interface ITranscript {
    transcript: string;
    confidence: number;
}

export type LocalizationOf<T> = { [language in Language]?: T }
export type IPrompt = LocalizationOf<string>

export enum UserInputSource {
    // noinspection JSUnusedGlobalSymbols
    Unspecified = 0,
    Screen = 1,
    Keyboard = 2
}

export interface IKeyPress {
    char: string;
    shift: boolean;
    keyKind: KeyKind;
}

export type UserInputBase = { sequence: number; isInterrupt: boolean }
export type GestureUserInput = UserInputBase & { kind: "gesture", gesture: Gesture, source: UserInputSource }
export type KeyPressUserInput = UserInputBase & { kind: "keyPress" } & IKeyPress
export type CommandUserInput = UserInputBase & { kind: "command", transcript: string }
export type ObjectUserInput = UserInputBase & { kind: "object", object: any }
export type RecordingUserInput = UserInputBase & { kind: "recording", "recordingId": string }

export type UserInput = GestureUserInput | KeyPressUserInput | CommandUserInput | ObjectUserInput | RecordingUserInput

export type DeregisterFunction = () => void;

export interface IGeoLocation {
    longitude: number;
    latitude: number;
}

export interface IGPSLocation extends IGeoLocation {
    accuracy: number;
}

export interface IUserProfile {
    userId: string;
}

export type PhoneNumber = {
    id: number;
    number: string;
    normalizedNumber: string;
    kind: string;
}

export type Contact = {
    id: number;
    name: string;
    numbers: PhoneNumber[];
    starred: boolean;
    deleted?: true
}

export type CallResult = { callId: number | null }

export enum CallDirection {
    Incoming = 1,
    Outgoing = 2,
    Unspecified = -1
}

export type CallLogRecord = {
    id: number;
    number: string | null;
    contact: null | { displayName: string, contactId: number }
    timestamp: number;
    connected: boolean;
    direction: CallDirection
    durationMs: number;
    acknowledged: boolean
}

export type CallLog = {
    records: CallLogRecord[]
}

export interface IPlayerStatus {
    readonly duration: number;
    readonly position: number;
    readonly speed: number;
}

export interface IVoxmateVoiceDescriptor {
    voiceId: string;
    name: string | null;
    language: Language;
    gender: "Male" | "Female" | "Unspecified";
    network: boolean;
    provider: string;
    locale: string;
}

export interface IVoiceSettings {
    id: string;
    speed: number;
}

export interface IVoiceSettingsSpecification {
    info: IVoiceSettings | null;
    dynamicInfo: IVoiceSettings | null;
    content: IVoiceSettings | null;
    dynamicContent: IVoiceSettings | null;
}

export enum VoxmateKeyboard {
    Disabled = 0,
    UsQWERTYKeyboardSimplified = 1,
    UsQWERTYKeyboardGestureAware = 2
}

export interface IVoxmateSettings {

    enableHapticFeedbackOnMenuOptions: boolean;
    enableShushGesture: boolean;
    enableSpeechView: boolean;
    surfaceTheme: 0 | 1 | 2 | 3;
    devicePower: number;
    useImperialUnits: boolean;
    enableTalkBackCompatibilityMode: boolean;
    keyboard: VoxmateKeyboard,
    textToSpeechSettings: {

        allowCloudVoices: boolean;
        defaultSpeed: number;

        [EN]: IVoiceSettingsSpecification;
        [RU]: IVoiceSettingsSpecification;
        [ET]: IVoiceSettingsSpecification;
        [ES]: IVoiceSettingsSpecification;
        [FR]: IVoiceSettingsSpecification;
    }
}

export interface IRecordingInfo {
    duration: number | null;
}

export interface IPortalToken {
    token: string;
}

export interface IMediaFile {
    resourceId: string;
    name: string; //like file name
    title: string; //file metadata extracted name
    track: number;
    size: number;
}

export interface IMediaFileFolder {
    name: string | "root";
    folders: IMediaFileFolder[];
    files: IMediaFile[];
}

export interface IMediaFileInfo {
    ok: boolean;
    album: string | null;
    artist: string | null;
    genre: string | null;
}

export type IsolateScopeFunction = (scopeId: string) => any;
export type AnyFunction<T = any> = (...params: any[]) => T;


export interface IVisionSwatch {
    pixelCount: number;
    color: string;
}

export type ScannedText = {
    blocks: {
        text: string,
        language: string
    }[];
    modelReady: boolean;
}

export interface IVision {
    resourceId: string | null;

    text: {
        text: string;
        blocks: string[];
        modelReady: boolean;
    };
    palette: {
        swatches: IVisionSwatch[];
    };
}

export interface IVoxletManifest {
    ident: string;
    assets: string[];
    preload: boolean;
    requiredEngineVersion: number;
    settingsJson: string;
    version: number;
    signature: string;
}

export interface ICastStreamInspectionResult {
    ok: boolean;
    title: string | null;
}

export enum KeyKind {
    Regular = 0,
    Backspace = 1,
    Escape = 2,
    Command = 3
}


export interface IInputMethods {
    hasSpeechToTextCapability: boolean;
    hasHardwareKeyboard: boolean;
}

export enum ClipboardDataKind {
    Empty = 0,
    Text = 1
}

export interface IClipboard {
    kind: ClipboardDataKind,
    data: string;
}

export enum SocketState {
    Connecting = 0,
    Open = 1,
    Closing = 2,
    Closed = 3
}

// noinspection JSUnusedGlobalSymbols
export enum SocketEventKind {
    Open = 0,
    TextMessage = 1,
    BinaryMessage = 2,
    Closing = 3,
    Close = 4,
    Error = 5
}

export interface ISocketInfo {
    state: number;
    bufferedAmount: number;
    protocol: string;
    extensions: string;
}

export interface ISocketEvent {
    kind: SocketEventKind;
    sequence: number;
    text: string | null;
    buffer: ArrayBuffer | null;
    error: string | null;
}

export interface INotification {
    notificationId: string;
    created: number;
    voxlet: string;
    type: "voxlet-push";
    text: string;
    title: string;
    data?: any;
    awk: boolean;
}

export type CallbackHandleId = number;
export type SocketId = string;

export type SocketEventHandler = (info: ISocketInfo, event: ISocketEvent) => void;

export interface IYouTubePlaybackResult {
    error: boolean;
    position: number;
    duration: number;
    info: boolean;
    haveApp: boolean;
}

export interface IYouTubeVideo {
    videoId: string;
    title: string;
    channelTitle: string;
    description?: string; // Will be missing if not authed
    channelId?: string; // Will be missing if not authed
}

export interface IYouTubeSetupResult {
    ok: boolean;
    error?: string;
}

export interface IYouTubeChannel {
    channelId: string;
    title: string;
    description: string;
}

export interface IYouTubeMultipartChannelResult {
    next: string;
    channels: IYouTubeChannel[];
}

export interface IYouTubeMultipartVideoResult {
    next: string;
    videos: IYouTubeVideo[];
}

export interface IYouTubeOperationStatus {
    ok: boolean;
}

export interface IYouTubeSubscriptionStatus {
    exists: boolean;
    subscriptionId: string;
}

export interface INotificationCollection {
    notifications: INotification[];
}

export interface INotificationSettings {
    dnd: boolean;
}

export type VoxmateEvent = {
    kind: "settings"
    settings: IVoxmateSettings
}

export type VoxmateFeature = "beta" | "beta-update-1" | "beta-update-2" | "beta-update-6" | "beta-update-7";

export type EnvironmentInfo = {
    readonly isDevelopment: boolean;
    readonly fuzzing: boolean;
    readonly version: {
        major: number,
        code: number
    }
    readonly features: VoxmateFeature[];
    readonly device: {
        platform: "android" | "simulator",
        version: number;
        model: string;
        locale: string;
    }
}

export type AndroidApp = { "label": string, "packageName": string }
export type AndroidAppManifest = { "apps": AndroidApp[] }

export interface VoxmatePermissionManifest {
    "location": boolean,
    "phone": boolean,
    "contacts": boolean,
    "calendar": boolean,
    "storage": boolean,
    "camera": boolean,
    "microphone": boolean,
    "launcher": boolean
}

export type VoxmatePermission = keyof VoxmatePermissionManifest | "*"

export type VoxmateTextEntity =
    { start: number, end: number } &
    (
        { type: "url", url: string } |
        { type: "youtube-video", videoId: string } |
        { type: "phone-number", phoneNumber: string }
        )

export type TokenizedText = {
    entities: VoxmateTextEntity[];
}

export type SkuOffer = {
    sku: string;
    name: string;
    period: string;
    promo: string;
    assistiveText: string;
}
export type SubscriptionOffer = {
    offer: string;
    promo: string;
    skus: SkuOffer[];
}

export enum SubscriptionStatus {
    Unknown = 0,
    Unsubscribed = 1,
    Subscribed = 2
}

export type QRCode = { data: string } & (
    { type: "phone", phone: string } |
    { type: "email", email: string } |
    { type: "geo", geo: IGeoLocation } |
    { type: "link", link: { title: string, url: string } } |
    { type: "unknown" }
    );

export type BlockInfo = { blocked: false } | { blocked: true, message: string, lifts: number }

export type RecordingId = string;
export type ResourceId = string

export interface IVoxmateStatic {

    notifications: {
        getNotifications(): IVoxmatePromise<INotificationCollection>;
        getNotifications(onlyCurrentVoxlet: boolean): IVoxmatePromise<INotificationCollection>;
        dismiss(notificationId: string): IVoxmatePromise<{}>;
        trigger(notificationId: string): IVoxmatePromise<{}>
        toggleDND(dnd: boolean): IVoxmatePromise<INotificationSettings>
        settings(): IVoxmatePromise<INotificationSettings>
    };

    environment: {
        info(): EnvironmentInfo;
    };

    vision: {
        scanQRCode(): IVoxmatePromise<QRCode>;  // Cancel this to hide the view finder
        scanText(): IVoxmatePromise<ScannedText>; // Cancel this to hide the view finder

        showQRCode(data: string): IVoxmatePromise<true>; // Cancel this to hide the QR code
        showImage(resourceId: ResourceId): IVoxmatePromise<true>; // Cancel this to hide the image
    };

    debug: {
        action(action: string, param: string, param2?: string): Promise<true>;
        dump(name: string, any: any): void
    };

    phone: {
        getCallLog(): IVoxmatePromise<CallLog>
        acknowledgeCall(callId: number): IVoxmatePromise<boolean>
        getCall(callId: number): IVoxmatePromise<CallLogRecord>

        getContacts(): IVoxmatePromise<Contact[]>;
        addContact(name: string, number: string): IVoxmatePromise<boolean>
        renameContact(contactId: number, name: string): IVoxmatePromise<boolean>
        deleteContact(contactId: number): IVoxmatePromise<boolean>
        starContact(contactId: number, star: boolean): IVoxmatePromise<boolean>

        addNumber(contactId: number, number: string): IVoxmatePromise<boolean>
        deleteNumber(numberId: number): IVoxmatePromise<boolean>

        isDialer(): IVoxmatePromise<boolean>
        promoteToDialer(): IVoxmatePromise<boolean>
        call(phoneNumber: string): IVoxmatePromise<CallResult>;
    };

    input: {

        subscribe(fn: (ui: UserInput) => void, scope: boolean): DeregisterFunction;

        // Notify the VM that the following gestures need to be executed in new scopes.
        // To reset, call with empty array.
        setGestureScopingIntent(gestures: Gesture[]): void;
        setRecordingScopingIntent(enable: boolean): void;
        setCommandScopingIntent(enable: boolean): void;

        // default timeout is 50ms
        // internal means VM only (no jukebox interrupts), default = true
        rejectGesture(gesture: Gesture, timeout?: number, internally?: boolean): undefined;

        // default timeout is 50ms
        // kind is Regular by default. Shift is inferred from capitalization
        // internal means VM only (no jukebox interrupts), default = true
        rejectKey(char: string, kind?: KeyKind, shift?: boolean, timeout?: number, internally?: boolean): undefined;

        // Note, if json == 'null', the rejected object will be undefined.
        rejectObject(json: string): undefined;

        setVoiceInputMode(mode: VoiceInputMode): void;

        getInputMethods(): IVoxmatePromise<IInputMethods>;

        showKeyboard(): IVoxmatePromise<boolean>
    };

    events: {
        subscribe(fn: (event: VoxmateEvent) => void): DeregisterFunction;
    };

    audio: {
        say(text: string | IPrompt, options?: ISpeechOptions): IVoxmatePromise<IAudioResult>;

        preload(text: string | IPrompt, options?: ISpeechOptions): IVoxmatePromise<void>;

        sound(sound: Sound): void;

        haptic(signal: HapticSignal): void;

        getVoices(actor: Actor, language: Language): IVoxmatePromise<IVoxmateVoiceDescriptor[]>;

        setVolume(volume: number): void;

        stopChannel(channel: string): undefined; // Interrupts a background TTS channel

        player: {
            init(resourceId: ResourceId, streaming: boolean, background?: boolean, looping?: boolean): IVoxmatePromise<string>
            prep(playerId: string): IVoxmatePromise<boolean>
            getStatus(playerId: string): IVoxmatePromise<IPlayerStatus>

            play(playerId: string): IVoxmatePromise<IAudioResult>
            interrupt(playerId: string): IVoxmatePromise<void>;
            dispose(playerId: string): IVoxmatePromise<void>
            setSpeed(playerId: string, speed: number): IVoxmatePromise<void>
            setVolume(playerId: string, volume: number): IVoxmatePromise<void>
            setPosition(playerId: string, position: number): IVoxmatePromise<void>
        }

        recordings: {
            buffer(recordingId: RecordingId): IVoxmatePromise<string>
            info(recordingId: RecordingId): IVoxmatePromise<IRecordingInfo>
            metadata(recordingId: RecordingId): IVoxmatePromise<any>
            save(recordingId: RecordingId, meta: string): IVoxmatePromise<null>
            save(recordingId: RecordingId): IVoxmatePromise<true>

            delete(recordingId: RecordingId): IVoxmatePromise<true>
            list(): IVoxmatePromise<RecordingId[]>

            // NB. Copy makes a temporary copy. Will need to save it also.
            copy(recordingId: RecordingId): IVoxmatePromise<string>
            copy(recordingId: RecordingId, sourceIdent: string): IVoxmatePromise<string>
        }
    };

    task: {

        getCurrentScopeId(): string;

        executeOnScope(scope: string, fn: IsolateScopeFunction): boolean;

        delay(timeout: number): IVoxmatePromise<null>;

        hold(releaseId?: string): DeregisterFunction;

        isolate(fn: IsolateScopeFunction): IVoxmatePromise<boolean>;

        ground(scopeId: string): IVoxmatePromise<boolean>;

        clearAll(): void;
    };

    http: {
        request(url: string, method: "GET" | "POST", payload: string | null, headers: { [key: string]: string }, sign?: boolean): IVoxmatePromise<IHttpResult>
        uploadResource(url: string, resourceId: ResourceId, headers: { [key: string]: string }): IVoxmatePromise<IHttpResult>
    };

    location: {
        //TODO: GUARD-PERM-GPS
        get(): IVoxmatePromise<IGPSLocation>
    };

    filestore: {
        save(url: string, overwrite: boolean, headers: { [key: string]: string }, key: string | null): IVoxmatePromise<ResourceId>
        get(resourceId: ResourceId): IVoxmatePromise<IResource>
        mime(resourceId: ResourceId): IVoxmatePromise<string>
        exists(resourceId: ResourceId): IVoxmatePromise<boolean>
        clear(resourceId: ResourceId): IVoxmatePromise<void>
        clearAll(keep?: ResourceId[]): IVoxmatePromise<void>
        preloadAssets(): IVoxmatePromise<void>
    };

    special: {
        inspectIceCastStream(url: string): IVoxmatePromise<ICastStreamInspectionResult>
        youtube: {
            play(videoId: string, continueFrom: number): IVoxmatePromise<IYouTubePlaybackResult>
            info(videoId: string): IVoxmatePromise<IYouTubeVideo>
            subscriptions(): IVoxmatePromise<IYouTubeMultipartChannelResult>
            search(query: string): IVoxmatePromise<IYouTubeMultipartVideoResult>
            related(videoId: string): IVoxmatePromise<IYouTubeMultipartVideoResult>
            getChannelVideos(channelId: string): IVoxmatePromise<IYouTubeMultipartVideoResult>
            setup(): IVoxmatePromise<IYouTubeSetupResult>;
            checkSubscription(channelId: string): IVoxmatePromise<IYouTubeSubscriptionStatus>
            subscribe(channelId: string): IVoxmatePromise<IYouTubeOperationStatus>;
            unsubscribe(subscriptionId: string): IVoxmatePromise<IYouTubeOperationStatus>;
        }
    };

    system: {

        goto(target: string, payload?: any, version?: number): IVoxmatePromise<IVoxletExecutionResult>;

        profile(): IVoxmatePromise<IUserProfile>;

        trigger_user_action(value: any): void;

        // Shuts down Voxmate in app-mode, Restarts in Launcher Mode.
        quit(): Promise<any>;

        checkBatteryLevel(): IVoxmatePromise<number>;

        copyToClipboard(kind: ClipboardDataKind, data: String): void;

        loadFromClipboard(): IVoxmatePromise<IClipboard>;

        subscriptions: {
            getBlockInfo(): BlockInfo;
            getSubscriptionStatus(): SubscriptionStatus;
            getSubscriptionOffer(): IVoxmatePromise<SubscriptionOffer>;
            subscribe(sku: string): IVoxmatePromise<Boolean>;
            manage(): IVoxmatePromise<Boolean>
        }

        billboard: {
            show(text: string): IVoxmatePromise<string>
            close(postId: string): IVoxmatePromise<void>
        }

        portal: {
            getAuthToken(): IVoxmatePromise<IPortalToken>
        }

        external: {
            list(): IVoxmatePromise<IMediaFileFolder>;
            info(resourceId: string): IVoxmatePromise<IMediaFileInfo>;
        }

        reflection: {
            getVoxletVersion(): number;
            getVoxletManifest(): IVoxletManifest;
        }

        telemetry: {
            error(message: string, trace?: string): undefined;
            inc(key: string): void; // signal key increase
        }

        os: {
            open(uri: string): undefined
            isLauncher(): boolean;
            getAppManifest(): IVoxmatePromise<AndroidAppManifest>;
            launch(packageName: string): IVoxmatePromise<Boolean>;
            showHomeScreenSettings(): IVoxmatePromise<Boolean>
            getPermissions(required: VoxmatePermission[]): IVoxmatePromise<VoxmatePermissionManifest>
            getPermissions(required: VoxmatePermission[], request: boolean): IVoxmatePromise<VoxmatePermissionManifest>
        }
    };

    settings: {
        getVoxletSettings(): IVoxmatePromise<any>;
        setVoxletSettings(settings: any): IVoxmatePromise<void>;
        getVoxmateSettings(): IVoxmatePromise<IVoxmateSettings>;
        setVoxmateSettings(settings: IVoxmateSettings): IVoxmatePromise<unknown>;
    };

    utility: {
        detectLanguage(samples: string[]): IVoxmatePromise<string>
        splitIntoSentences(text: string): string[];
        extractUrls(text: string): string[];
        emojiManifest(): { [emoji: string]: string }; // Get Supported Emojis
        extractTextEntities(text: string): IVoxmatePromise<TokenizedText>
    };

    sockets: {
        openSocket(url: string, protocols: string[], headers: { [head: string]: string }, handler: SocketEventHandler): SocketId
        sendData(socketId: SocketId, data: string | ArrayBuffer): void;
        listSockets(): SocketId[];
        closeSocket(socketId: SocketId, code?: number): void;
    };
}

/* EXPORTS */

export const global: any = Function('return this')();
export const exit: (code: number) => never = global["exit"];
export const voxmate = global["voxmate"] as IVoxmateStatic;
export default voxmate;