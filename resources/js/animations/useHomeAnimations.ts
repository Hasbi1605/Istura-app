import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Screen } from "../domain/types";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Animasi GSAP untuk halaman publik. Dipisah dari App.tsx agar shell tetap
// ramping; perilaku & timeline tidak diubah sama sekali.
//
// - useNavEntranceAnimation: animasi masuk navbar, sekali saat mount.
// - useHomeHeroAnimation: hero + scroll-story, hanya jalan di screen "home".
export function useNavEntranceAnimation(pageRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        return;
      }
      // Animate the navbar entrance only once on initial mount so it doesn't
      // flicker each time we switch screens.
      gsap.from(".nav-shell", { y: -24, opacity: 0, duration: 0.7, ease: "power3.out" });
    },
    { scope: pageRef, dependencies: [] },
  );
}

export function useHomeHeroAnimation(
  pageRef: RefObject<HTMLElement | null>,
  screen: Screen,
) {
  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        return;
      }
      if (screen !== "home") {
        // Hero animations only run on home; on other screens leave elements
        // at their baseline CSS so the navbar doesn't flicker.
        return;
      }

      const ctx = gsap.context(() => {
        // Defensive guard: kalau target hero tidak ada di DOM (mis. user
        // navigasi ke route lain sebelum useGSAP sempat bersih), skip seluruh
        // setup supaya GSAP tidak melempar warning "target not found".
        if (!document.querySelector(".hero-visual")) return;
        gsap.from(".hero-copy > *", {
          y: 30,
          opacity: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: "power3.out",
        });
        gsap.from(".hero-visual", {
          y: 42,
          scale: 0.94,
          opacity: 0,
          duration: 1.05,
          ease: "power3.out",
        });
        const mm = gsap.matchMedia();

        mm.add("(min-width: 641px)", () => {
          gsap.from(".miky-hero-stack", {
            y: 34,
            rotate: -3,
            scale: 0.9,
            opacity: 0,
            duration: 1.05,
            delay: 0.12,
            ease: "back.out(1.35)",
            clearProps: "transform,opacity",
          });
          gsap.from(".miky-speech", {
            x: 18,
            y: 18,
            scale: 0.88,
            opacity: 0,
            duration: 0.64,
            delay: 0.9,
            ease: "back.out(1.55)",
          });
          gsap.from(".miky-wave-line", {
            scale: 0.2,
            opacity: 0,
            duration: 0.48,
            stagger: 0.1,
            delay: 0.82,
            transformOrigin: "left bottom",
            ease: "back.out(2)",
          });
          gsap.to(".miky-stage-greeting", {
            y: -10,
            rotate: 0.7,
            duration: 3.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          gsap.to(".miky-speech", {
            y: -4,
            duration: 2.8,
            delay: 1.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          gsap.to(".miky-wave-lines", {
            x: 3,
            rotate: 5,
            duration: 1.45,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

        mm.add("(max-width: 640px)", () => {
          gsap.set(".miky-stage-greeting", {
            autoAlpha: 0,
            y: 76,
            rotate: -1.4,
            scale: 0.94,
          });
          gsap.set(".miky-speech", {
            autoAlpha: 0,
            y: 14,
            scale: 0.92,
          });
          gsap.set(".miky-wave-line", {
            opacity: 0,
            scale: 0.2,
            transformOrigin: "left bottom",
          });

          const mikyScroll = gsap.timeline({
            scrollTrigger: {
              trigger: ".hero-visual",
              start: "top 62%",
              end: "bottom 28%",
              scrub: 0.65,
            },
          });

          mikyScroll
            .to(".miky-stage-greeting", {
              autoAlpha: 1,
              y: 0,
              rotate: 0,
              scale: 1,
              duration: 0.28,
              ease: "power3.out",
            })
            .to(
              ".miky-speech",
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.18,
                ease: "power2.out",
              },
              "<0.06",
            )
            .to(
              ".miky-wave-line",
              {
                opacity: (index) => [0.92, 0.72, 0.5][index] ?? 0.7,
                scale: 1,
                stagger: 0.06,
                duration: 0.16,
                ease: "power2.out",
              },
              "<0.04",
            )
            .to(".miky-stage-greeting", {
              autoAlpha: 1,
              y: -8,
              rotate: 0.35,
              duration: 0.32,
              ease: "none",
            })
            .to(".miky-stage-greeting", {
              autoAlpha: 0,
              y: -58,
              rotate: 1.2,
              scale: 0.97,
              duration: 0.22,
              ease: "power2.in",
            });
        });

        gsap.utils.toArray<HTMLElement>(".scale-fade").forEach((element) => {
          gsap.fromTo(
            element,
            { y: 28, scale: 0.98, opacity: 0 },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              duration: 0.64,
              ease: "power3.out",
              clearProps: "transform,opacity",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                toggleActions: "play none none none",
                once: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".process-card-scrub").forEach((element) => {
          gsap.fromTo(
            element,
            { scale: 0.86, opacity: 0.42, filter: "brightness(0.55)" },
            {
              scale: 1,
              opacity: 1,
              filter: "brightness(1)",
              ease: "none",
              scrollTrigger: {
                trigger: element,
                start: "top 82%",
                end: "bottom 22%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".reveal-word").forEach((word, index) => {
          gsap.to(word, {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".scroll-story",
              start: `top+=${index * 9} 72%`,
              end: `top+=${index * 9 + 140} 42%`,
              scrub: true,
            },
          });
        });

        mm.add("(min-width: 920px)", () => {
          ScrollTrigger.create({
            trigger: ".desire-grid",
            start: "top 10%",
            end: "bottom 82%",
            pin: ".desire-pin",
            pinSpacing: false,
          });
        });

        return () => mm.revert();
      }, pageRef);

      let isRefreshActive = true;
      const refreshScrollTriggers = () => {
        window.requestAnimationFrame(() => {
          if (isRefreshActive) {
            ScrollTrigger.refresh();
          }
        });
      };

      refreshScrollTriggers();

      if (document.readyState === "complete") {
        refreshScrollTriggers();
      } else {
        window.addEventListener("load", refreshScrollTriggers, { once: true });
      }

      void document.fonts?.ready.then(() => {
        if (isRefreshActive) {
          refreshScrollTriggers();
        }
      });

      return () => {
        isRefreshActive = false;
        window.removeEventListener("load", refreshScrollTriggers);
        ctx.revert();
      };
    },
    { scope: pageRef, dependencies: [screen] },
  );
}
