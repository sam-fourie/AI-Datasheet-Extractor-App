"use client";

import { Copy } from "lucide-react";

import { IconButton } from "./icon-button";
import { useToast } from "./toast";

export type CopyButtonProps = {
  className?: string;
  /** Accessible name, e.g. "Copy part number". */
  label?: string;
  value: string;
};

/** Copies `value` to the clipboard and confirms with a "Copied" toast. */
export function CopyButton({
  className,
  label = "Copy",
  value,
}: CopyButtonProps) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.show({
        durationMs: 2000,
        id: "copy",
        title: "Copied",
        tone: "success",
      });
    } catch {
      toast.show({
        id: "copy",
        title: "Couldn't copy to the clipboard",
        tone: "danger",
      });
    }
  }

  return (
    <IconButton
      className={className}
      icon={<Copy />}
      label={label}
      onClick={() => void copy()}
      size="sm"
    />
  );
}
