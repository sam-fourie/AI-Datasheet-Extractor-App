import type { CSSProperties, ComponentPropsWithRef } from "react";

import {
  controlClassName,
  selectControlClassName,
  type ControlSize,
} from "./control-styles";

const chevronBackground =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27 fill=%27none%27 stroke=%27%236e6e73%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27%3E%3Cpath d=%27m4.5 6.5 3.5 3.5 3.5-3.5%27 /%3E%3C/svg%3E")';

export type SelectFieldProps = ComponentPropsWithRef<"select"> & {
  controlSize?: ControlSize;
  invalid?: boolean;
};

export function SelectField({
  className,
  controlSize = "md",
  invalid = false,
  style,
  ...props
}: SelectFieldProps) {
  const selectStyle = {
    backgroundImage: chevronBackground,
    backgroundPosition: "right 0.625rem center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "1rem",
    ...style,
  } satisfies CSSProperties;

  return (
    <select
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        selectControlClassName(controlSize),
        className,
      )}
      style={selectStyle}
    />
  );
}
