"use client";
import { Printer } from "lucide-react";

export default function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
      <Printer size={14} /> {label}
    </button>
  );
}
