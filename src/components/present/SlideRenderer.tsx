import { useMemo } from "react";
import { RegionRenderer } from "./RegionRenderer";

interface SlideContent {
  regionId: string;
  type: string;
  data: any;
}

interface Slide {
  id: string;
  order: number;
  layoutId: string;
  title: string;
  subtitle?: string;
  content: SlideContent[];
  notes?: string;
  imageUrl?: string;
}

interface LayoutRegion {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: string;
  level?: number;
  muted?: boolean;
  size?: string;
  zIndex?: number;
  color?: string;
  style?: string;
  objectFit?: string;
  columns?: number;
  italic?: boolean;
  content?: string;
}

interface Layout {
  id: string;
  name: string;
  description: string;
  category: string;
  regions: LayoutRegion[];
}

interface SlideRendererProps {
  slide: Slide;
  layouts: Layout[];
  theme?: "default" | "light" | "vibrant";
  className?: string;
  isPreview?: boolean;
}

export function SlideRenderer({ slide, layouts, theme = "default", className = "", isPreview = false }: SlideRendererProps) {
  const layout = useMemo(() => 
    layouts.find(l => l.id === slide.layoutId) || layouts[0],
    [layouts, slide.layoutId]
  );

  const themeColors = useMemo(() => {
    switch (theme) {
      case "light":
        return {
          background: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 11%)",
          primary: "hsl(217 91% 50%)",
          muted: "hsl(215 16% 47%)",
        };
      case "vibrant":
        return {
          background: "hsl(260 50% 10%)",
          foreground: "hsl(0 0% 100%)",
          primary: "hsl(280 100% 65%)",
          muted: "hsl(260 20% 70%)",
        };
      default:
        return {
          background: "hsl(222 47% 11%)",
          foreground: "hsl(210 40% 98%)",
          primary: "hsl(217 91% 60%)",
          muted: "hsl(215 20% 65%)",
        };
    }
  }, [theme]);

  // Get content for a specific region
  const getRegionContent = (regionId: string) => {
    return slide.content?.find(c => c.regionId === regionId);
  };

  // Check if layout is a special full-bleed type
  const isFullBleed = ["title-cover", "section-divider"].includes(slide.layoutId);
  const isSectionDivider = slide.layoutId === "section-divider";

  return (
    <div 
      className={`relative font-raleway overflow-hidden ${className}`}
      style={{
        aspectRatio: "16/9",
        background: isSectionDivider 
          ? `linear-gradient(135deg, ${themeColors.primary}, hsl(217 80% 45%))` 
          : themeColors.background,
        color: themeColors.foreground,
      }}
    >
      {/* Background gradient overlay for cover slides */}
      {isFullBleed && !isSectionDivider && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg, ${themeColors.background} 0%, hsl(217 33% 17%) 100%)`,
          }}
        />
      )}

      {/* Regions */}
      <div className="absolute inset-0">
        {layout?.regions.map(region => {
          const content = getRegionContent(region.id);
          
          // Handle special region types
          if (region.type === "overlay") {
            return (
              <div
                key={region.id}
                className="absolute"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  zIndex: region.zIndex || 1,
                  background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)",
                }}
              />
            );
          }

          if (region.type === "solid") {
            return null; // Background handled above
          }

          if (region.type === "divider") {
            return (
              <div
                key={region.id}
                className="absolute"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: "2px",
                  background: themeColors.primary,
                  zIndex: region.zIndex || 1,
                }}
              />
            );
          }

          if (region.type === "decoration" && region.content) {
            return (
              <div
                key={region.id}
                className="absolute font-serif"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  fontSize: isPreview ? "2rem" : "6rem",
                  color: themeColors.primary,
                  opacity: 0.3,
                  zIndex: region.zIndex || 1,
                }}
              >
                {region.content}
              </div>
            );
          }

          return (
            <div
              key={region.id}
              className="absolute"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
                zIndex: region.zIndex || 1,
              }}
            >
              <RegionRenderer
                region={region}
                content={content}
                slideTitle={slide.title}
                slideSubtitle={slide.subtitle}
                themeColors={themeColors}
                isPreview={isPreview}
              />
            </div>
          );
        })}
      </div>

      {/* Fallback: If no content matches regions, show title and content directly */}
      {(!slide.content || slide.content.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          <h2 
            className="font-bold mb-4"
            style={{ 
              fontSize: isPreview ? "1.25rem" : "2.5rem",
              color: themeColors.foreground,
            }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p 
              className="opacity-80"
              style={{ 
                fontSize: isPreview ? "0.75rem" : "1.25rem",
                color: themeColors.muted,
              }}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
