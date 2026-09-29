import { cn } from "@/components/ui";
import { getInitials } from "@/lib/identity";

export type AccountAvatarProps = {
  className?: string;
  name: string;
  size?: "md" | "lg";
};

const sizeClassNames = {
  lg: "size-10 text-body",
  md: "size-7 text-caption",
} as const;

/**
 * The signed-in person's initials in a neutral circle: the sidebar account
 * row, the mobile account button and its panel. Decorative, so callers name
 * the person in text or in the control's label.
 */
export function AccountAvatar({ className, name, size = "md" }: AccountAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-pill bg-surface-sunken font-semibold text-text-muted select-none",
        sizeClassNames[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
