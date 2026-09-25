import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { CircleAlert } from "lucide-react";

import { cn } from "./cn";
import { Label } from "./label";

type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true";
  id?: string;
};

export type FieldProps = {
  children: ReactNode;
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  label?: ReactNode;
  required?: boolean;
};

function joinAttributeValues(...values: Array<string | undefined>) {
  const result = values.filter(Boolean).join(" ");
  return result || undefined;
}

export function Field({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
  required = false,
}: FieldProps) {
  const childId =
    isValidElement<FieldControlProps>(children) && children.props.id
      ? children.props.id
      : undefined;
  const controlId = htmlFor ?? childId;
  const hintId = hint && controlId ? `${controlId}-hint` : undefined;
  const errorId = error && controlId ? `${controlId}-error` : undefined;
  const describedBy = joinAttributeValues(hintId, errorId);

  let content = children;

  if (isValidElement<FieldControlProps>(children)) {
    const element = children as ReactElement<FieldControlProps>;

    content = cloneElement(element, {
      "aria-describedby": joinAttributeValues(
        element.props["aria-describedby"],
        describedBy,
      ),
      "aria-invalid":
        element.props["aria-invalid"] ?? (error ? true : undefined),
      id: element.props.id ?? controlId,
    });
  }

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={controlId}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-text-muted">
              *
            </span>
          ) : null}
        </Label>
      ) : null}
      {content}
      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1 text-caption text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
