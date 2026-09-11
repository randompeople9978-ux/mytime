import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchActiveAds, fetchAdInterval, type Ad } from "@/lib/ads";

/** Carousel iklan landscape (16:9) yang bergeser otomatis tiap 5 atau 10 detik. */
export function AdsCarousel() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [interval, setIntervalSec] = useState(5);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    void (async () => {
      const [rows, sec] = await Promise.all([fetchActiveAds(), fetchAdInterval()]);
      setAds(rows);
      setIntervalSec(sec);
    })();
  }, []);

  useEffect(() => {
    if (ads.length < 2 || paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % ads.length), interval * 1000);
    return () => clearInterval(t);
  }, [ads.length, interval, paused]);

  if (ads.length === 0) return null;

  const go = (next: number) => setI((next + ads.length) % ads.length);

  return (
    <section
      className="ads-wrap"
      aria-label="Iklan"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ads-frame">
        <div className="ads-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {ads.map((ad, idx) => {
            const img = (
              <img
                src={ad.image_url}
                alt={ad.title ?? `Iklan ${idx + 1}`}
                loading={idx === 0 ? "eager" : "lazy"}
              />
            );
            return (
              <div className="ads-slide" key={ad.id}>
                {ad.target_url ? (
                  <a href={ad.target_url} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
                {ad.title && <span className="ads-caption">{ad.title}</span>}
              </div>
            );
          })}
        </div>

        {ads.length > 1 && (
          <>
            <button className="ads-nav left" onClick={() => go(i - 1)} aria-label="Iklan sebelumnya">
              <ChevronLeft size={16} />
            </button>
            <button className="ads-nav right" onClick={() => go(i + 1)} aria-label="Iklan berikutnya">
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {ads.length > 1 && (
        <div className="ads-dots">
          {ads.map((ad, idx) => (
            <button
              key={ad.id}
              className={idx === i ? "on" : ""}
              onClick={() => setI(idx)}
              aria-label={`Iklan ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
