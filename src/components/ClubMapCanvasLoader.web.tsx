import React, { lazy, Suspense } from "react";
import { View } from "react-native";
import type ClubMapCanvas from "./ClubMapCanvas";
import { Loading } from "./ui";

const Canvas = lazy(() => import("./ClubMapCanvas"));

export default function ClubMapCanvasLoader(
  props: React.ComponentProps<typeof ClubMapCanvas>,
) {
  return (
    <Suspense
      fallback={
        <View style={{ height: props.height ?? 380, justifyContent: "center" }}>
          <Loading />
        </View>
      }
    >
      <Canvas {...props} />
    </Suspense>
  );
}
