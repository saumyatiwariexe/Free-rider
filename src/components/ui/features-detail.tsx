"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Link from "next/link"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

const dashboardTabs = [
  {
    id: 1,
    title: "Passive Ingestion",
    src: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&q=80&w=3840",
    alt: "Reads native source activity from GitHub, Figma, and Docs. Zero manual check-ins required.",
  },
  {
    id: 2,
    title: "Insight Reports",
    src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=3840",
    alt: "Generates objective contribution percentages, timelines, and plain-language insights instantly.",
  },
  {
    id: 3,
    title: "Zero Setup",
    src: "https://images.unsplash.com/photo-1507238692062-71092e071e62?auto=format&fit=crop&q=80&w=3840",
    alt: "Members link accounts in under 60 seconds. Groups form automatically from shared repos.",
  },
  {
    id: 4,
    title: "Un-cheatable",
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=3840",
    alt: "Avoids forms and peer reviews. Treats self-reporting as unreliable and bypasses bias.",
  }
]

export default function FeaturesDetail() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const headingRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Hero animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 80%",
      }
    })

    tl.fromTo(
      headingRef.current,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
    )
    .fromTo(
      textRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      "-=0.4"
    )
    .fromTo(
      sliderRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      "-=0.2"
    )

    // Parallax effect on scroll
    gsap.to(".feature-parallax", {
      yPercent: 15,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    })

    // Auto-slide interval
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev === dashboardTabs.length - 1 ? 0 : prev + 1))
    }, 5000)

    return () => {
      tl.kill()
      clearInterval(slideInterval)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  return (
    <div ref={sectionRef} className="py-24 overflow-hidden border-t border-white/5 relative bg-black/40">
      <div className="absolute inset-0 feature-parallax opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent blur-3xl"></div>
      
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <div className="text-center md:text-left mb-16 max-w-2xl">
          <h1 ref={headingRef} className="text-4xl text-left font-semibold tracking-tight sm:text-5xl text-white">
            Absolute clarity,<br /> mathematically derived.
          </h1>
          <p ref={textRef} className="mt-6 text-lg text-white/50 text-left font-medium">
            Explore the frictionless architecture that makes Free-Rider Tracker fundamentally un-cheatable.
          </p>
        </div>
        
        <div
          ref={sliderRef}
          className="relative h-[65vh] md:h-[75vh] w-full mt-10 perspective-1000"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {dashboardTabs.map((tab, index) => {
              const position = index - currentSlide;
              const isActive = position === 0;
              const zIndex = isActive ? 30 : 20 - Math.abs(position);
              
              // Map slides circularly so they don't jump abruptly from last to first
              let displayPosition = position;
              if (position > 1) displayPosition -= dashboardTabs.length;
              if (position < -2) displayPosition += dashboardTabs.length;

              const translateX = displayPosition * 80; // 80% offset each
              const scale = isActive ? 1 : 0.85;
              const opacity = Math.abs(displayPosition) > 1 ? 0 : 1;

              return (
                <div
                  key={tab.id}
                  className={`absolute transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-xl border ${isActive ? 'border-white/20' : 'border-white/5'} ${isActive ? 'shadow-2xl shadow-white/5' : 'shadow-none'}`}
                  style={{
                    transform: `translateX(${translateX}%) scale(${scale})`,
                    zIndex,
                    opacity
                  }}
                >
                  <div className="relative aspect-[16/9] w-[85vw] md:w-[60vw] max-w-5xl rounded-xl overflow-hidden bg-black">
                     <Image
                        src={tab.src}
                        alt={tab.alt}
                        fill
                        className="object-cover opacity-80 filter grayscale brightness-75 contrast-125"
                        priority={tab.id === 1}
                     />
                     {/* Glass Overlay on Non-Active */}
                     {!isActive && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                     )}
                     {/* Content Overlay */}
                     {isActive && (
                        <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                           <h3 className="text-2xl font-semibold tracking-tight text-white mb-2">{tab.title}</h3>
                           <p className="text-white/60 text-sm max-w-lg">{tab.alt}</p>
                        </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-6 md:gap-12 mt-12">
          {dashboardTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => goToSlide(index)}
              className={`pb-2 text-xs uppercase tracking-widest font-semibold transition-all border-b-2 ${currentSlide === index
                ? "text-white border-white"
                : "text-white/30 border-transparent hover:text-white/60"}`}
            >
              {tab.title}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
