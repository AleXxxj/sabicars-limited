import { VideoPlayer } from "@/components/blog/VideoPlayer";
import type { TodayVideo as TodayVideoData } from "@/lib/repositories/today";

/**
 * The day's video from the park, with one line from the founder. It sits in
 * his section of the homepage, under his photo and his quote: his face, his
 * words, then today's words.
 */
export function TodayVideo({ video }: { video: TodayVideoData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <div>
        <p className="text-sm font-medium text-text-muted">{video.label} from the park</p>
        <div className="mt-3">
          {/* The player names the clip plainly; his line is the quote beside it, not a caption printed twice. */}
          <VideoPlayer source={video.source} poster={video.source.kind === "youtube" ? video.source.poster : null} title={`${video.label} from the park`} />
        </div>
      </div>
      {video.line && (
        <figure>
          <blockquote className="font-display text-[1.6rem] leading-snug text-text-primary md:text-[2rem]">“{video.line}”</blockquote>
          <figcaption className="mt-3 text-sm text-text-muted">Ccristian Dee, {video.label === "Today's video" ? "today" : video.label.replace("'s video", "")}</figcaption>
        </figure>
      )}
    </div>
  );
}
