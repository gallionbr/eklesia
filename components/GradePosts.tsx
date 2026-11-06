"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Copy, Play } from "lucide-react";
import type { Post } from "@/lib/types";

/** Grade 3×N de posts, como no perfil do Instagram. */
export default function GradePosts({ posts, fixados }: { posts: Post[]; fixados?: ReactNode }) {
  return (
    <div className="grade">
      {fixados}
      {posts.map((p) => {
        const m = p.midias[0];
        return (
          <Link key={p.id} href={`/post?id=${p.id}`} aria-label={p.legenda.slice(0, 60) || "Post"}>
            {!m ? (
              <div className="grade-txt">{p.legenda.slice(0, 90)}</div>
            ) : m.tipo === "video" ? (
              <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" />
            ) : (
              <img src={m.url} alt="" loading="lazy" />
            )}
            {p.midias.length > 1 ? <Copy className="marca-multi" size={18} /> : m?.tipo === "video" ? <Play className="marca-multi" size={18} fill="currentColor" /> : null}
          </Link>
        );
      })}
    </div>
  );
}
