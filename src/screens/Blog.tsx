import React from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BLOG_POSTS } from "../content/blog";
import { Banner, Empty, Screen, useUIStyles } from "../components/ui";
export default function Blog() {
  const s = useUIStyles();

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return (
    <Screen title="Blog FootNation">
      {slug ? (
        post ? (
          <>
            <Text style={s.title}>{post.title}</Text>
            <Text style={s.small}>
              {post.author} ·{" "}
              {new Date(post.publishedAt).toLocaleDateString("fr-FR")} ·{" "}
              {post.readingTime} min
            </Text>
            {post.content.split("\n\n").map((paragraph, index) => (
              <Text
                key={index}
                selectable
                style={paragraph.startsWith("## ") ? s.h2 : s.text}
              >
                {paragraph.replace(/^## /, "")}
              </Text>
            ))}
          </>
        ) : (
          <Empty title="Article introuvable" />
        )
      ) : (
        <>
          <Banner
            eyebrow="LE MAGAZINE FOOTNATION"
            title="Le football, sur tous les terrains."
          />
          {BLOG_POSTS.map((p) => (
            <Pressable
              accessibilityRole="button"
              key={p.slug}
              onPress={() => router.push(`/blog/${p.slug}`)}
              style={s.card}
            >
              <Text style={s.small}>{p.readingTime} MIN DE LECTURE</Text>
              <Text style={s.h2}>{p.title}</Text>
              <Text style={s.subtitle}>{p.description}</Text>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
