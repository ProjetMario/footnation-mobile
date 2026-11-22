import React from "react";
import {
  CreationMediaActions,
  type CreationMediaPickerProps,
} from "./CreationMediaActions";
export function CreationMediaPicker(props: CreationMediaPickerProps) {
  return <CreationMediaActions {...props} />;
}
export default CreationMediaPicker;
