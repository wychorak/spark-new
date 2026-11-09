// Drop-in replacements for React Native Text/TextInput that show Polish source
// texts in the selected language. Unknown texts render unchanged.
import React, { forwardRef } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";
import { tr, useLanguage } from "./index";

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function translateChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return tr(children);
  if (!Array.isArray(children)) return children;
  if (children.every(isPrimitive)) {
    // `Masz {count} nowych` arrives as ["Masz ", 3, " nowych"]: translate it as one sentence.
    const joined = children.map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : "")).join("");
    const translated = tr(joined);
    if (translated !== joined) return translated;
  }
  return children.map((item) => (typeof item === "string" ? tr(item) : item));
}

// noTranslate: text written by people (chat messages) is shown exactly as sent.
export const Text = forwardRef<NativeText, TextProps & { noTranslate?: boolean }>(function Text({ noTranslate, ...props }, ref) {
  const language = useLanguage();
  if (language === "pl" || noTranslate) return <NativeText ref={ref} {...props} />;
  return <NativeText ref={ref} {...props}>{translateChildren(props.children)}</NativeText>;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput(props, ref) {
  const language = useLanguage();
  if (language === "pl" || !props.placeholder) return <NativeTextInput ref={ref} {...props} />;
  return <NativeTextInput ref={ref} {...props} placeholder={tr(props.placeholder)} />;
});
