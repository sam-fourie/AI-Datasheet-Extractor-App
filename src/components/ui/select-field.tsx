import type { CSSProperties, ComponentPropsWithoutRef } from "react";

import { controlClassName, selectControlClassName } from "./control-styles";

const chevronBackground =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27none%27 stroke=%27%23667085%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.6%27%3E%3Cpath d=%27m6 8 4 4 4-4%27 /%3E%3C/svg%3E")';

export type SelectFieldProps = ComponentPropsWithoutRef<"select"> & {
  invalid?: boolean;
};

export function SelectField({
  className,
  invalid = false,
  style,
  ...props
}: SelectFieldProps) {
  const selectStyle = {
    backgroundImage: chevronBackground,
    backgroundPosition: "right 1rem center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "1rem",
    ...style,
  } satisfies CSSProperties;

  return (
    <select
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(selectControlClassName, className)}
      style={selectStyle}
    />
  );
}
