import type { RefObject } from "react";
import type { Screen } from "../domain/types";
import { useHomeHeroAnimation, useNavEntranceAnimation } from "./useHomeAnimations";

export function HomeAnimationLayer({
  pageRef,
  screen,
}: {
  pageRef: RefObject<HTMLElement | null>;
  screen: Screen;
}) {
  useNavEntranceAnimation(pageRef);
  useHomeHeroAnimation(pageRef, screen);

  return null;
}
