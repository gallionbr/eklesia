"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** O perfil da igreja agora é a Home. */
export default function Igreja() {
  const router = useRouter();
  useEffect(() => { router.replace("/inicio"); }, [router]);
  return null;
}
