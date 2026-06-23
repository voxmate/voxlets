import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function timeFromNow(timestamp: string | number) {
    const mtime = new Date(parseFloat(timestamp as any));
    return dayjs(mtime).fromNow();
}