import React from "react";
import {
  CreationMediaActions,
  type CreationMediaPickerProps,
} from "./CreationMediaActions";

// Use the Android system picker instead of enumerating the device's library.
export function CreationMediaPicker(props: CreationMediaPickerProps) {
  return <CreationMediaActions {...props} />;
}

export default CreationMediaPicker;
