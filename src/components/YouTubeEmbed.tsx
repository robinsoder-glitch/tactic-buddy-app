import { useState } from "react";
import { Play } from "lucide-react";

type Props = {
  videoId: string;
  title: string;
};

export function YouTubeEmbed({ videoId, title }: Props) {
  const [active, setActive] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border bg-muted">
      <div className="relative aspect-video">
        {active ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="group absolute inset-0 size-full cursor-pointer"
            aria-label={`Spela upp video: ${title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={`Förhandsbild för videon ${title}`}
              className="size-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/45">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Play className="size-6 translate-x-0.5 fill-current" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="px-3 py-2 text-sm font-medium">{title}</p>
    </div>
  );
}
