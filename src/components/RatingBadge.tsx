import { Star, ThumbsUp, ThumbsDown } from "lucide-react";

export function computeScore(rating: number, likes: number, dislikes: number): number {
  // ranking score used for sorting
  return rating * 10 + likes - dislikes * 2;
}

export function RatingBadge({
  rating, likes, dislikes, compact = false,
}: { rating: number; likes: number; dislikes: number; compact?: boolean }) {
  if (compact) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--ink-soft)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--gold)", fontWeight: 700 }}>
          <Star size={11} fill="currentColor" />{rating.toFixed(1)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--success)", fontWeight: 600 }}>
          <ThumbsUp size={10} />{likes}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--danger)", fontWeight: 600 }}>
          <ThumbsDown size={10} />{dislikes}
        </span>
      </div>
    );
  }
  const score = computeScore(rating, likes, dislikes);
  return (
    <div className="rating-badge">
      <div className="rb-cell"><Star size={13} fill="currentColor" color="var(--gold)" /><b>{rating.toFixed(1)}</b><span>Rating</span></div>
      <div className="rb-cell"><ThumbsUp size={13} color="var(--success)" /><b>{likes}</b><span>Suka</span></div>
      <div className="rb-cell"><ThumbsDown size={13} color="var(--danger)" /><b>{dislikes}</b><span>Tidak</span></div>
      <div className="rb-cell"><b style={{ color: "var(--gold)" }}>{score}</b><span>Skor</span></div>
    </div>
  );
}
