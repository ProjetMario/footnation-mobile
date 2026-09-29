import React, { useCallback, useRef, useState } from "react";
import { FlatList, Modal, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

/** Opens on the chosen tile, retaining the same order and pagination as its grid. */
export function PagedMediaViewer<T>({
  items,
  initialKey,
  keyFor,
  renderItem,
  onClose,
  onLoadMore,
  loadingMore,
}: {
  items: T[];
  initialKey: string;
  keyFor: (item: T) => string;
  renderItem: (item: T, visible: boolean, height: number) => React.ReactNode;
  onClose: () => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const [height, setHeight] = useState(0);
  const [activeKey, setActiveKey] = useState(initialKey);
  const close = useRef(onClose);
  close.current = onClose;
  useFocusEffect(useCallback(() => () => close.current(), []));
  const index = Math.max(
    0,
    items.findIndex((item) => keyFor(item) === activeKey),
  );
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={{ flex: 1, backgroundColor: "#000" }}
      >
        <View
          style={{ flex: 1 }}
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        >
          {!!height && (
            <FlatList
              key={height}
              data={items}
              keyExtractor={keyFor}
              initialScrollIndex={index}
              getItemLayout={(_, i) => ({
                length: height,
                offset: height * i,
                index: i,
              })}
              pagingEnabled
              snapToInterval={height}
              decelerationRate="fast"
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              windowSize={3}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              extraData={activeKey}
              onScroll={(event) => {
                const next = Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    Math.round(event.nativeEvent.contentOffset.y / height),
                  ),
                );
                const item = items[next];
                if (item) setActiveKey(keyFor(item));
              }}
              scrollEventThrottle={64}
              renderItem={({ item }) => (
                <View style={{ height }}>
                  {renderItem(item, activeKey === keyFor(item), height)}
                </View>
              )}
              onEndReached={onLoadMore}
              onEndReachedThreshold={1}
            />
          )}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              alignSelf: "center",
              top: 18,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Text style={{ color: "white", fontSize: 11 }}>
              {index + 1} / {items.length}
              {loadingMore ? " · Chargement…" : ""}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
