import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Heart,
  Trophy,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND_EYEBROW, BRAND_INTRO, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const LANDING_FEATURES = [
  {
    icon: ClipboardList,
    title: "Planera träningar",
    text: "Schemalägg träningstillfällen, bygg träningspass och använd övningar från träningsbanken eller skapa egna.",
  },
  {
    icon: Trophy,
    title: "Planera matcher",
    text: "Välj spelare och en eller flera ledare, planera matchen och samla all matchinformation på samma plats.",
  },
  {
    icon: BookOpen,
    title: "Visa taktik",
    text: "Placera spelare och boll, rita löp- och passningsvägar och skapa sekvenser som kan spelas upp på taktiktavlan.",
  },
  {
    icon: Users,
    title: "Samla laget",
    text: "Hantera spelare och ledare samt håll kontakt med laget inför träningar, matcher och andra aktiviteter.",
  },
  {
    icon: GraduationCap,
    title: "Hitta övningar och kunskap",
    text: "Använd träningsbanken och kunskapsbanken för att hitta övningar, träningspass och pedagogiskt stöd.",
  },
  {
    icon: CalendarDays,
    title: "Få överblick",
    text: "Se kalender, planeringsstatus, närvaro, aktiviteter och relevant statistik för laget.",
  },
];

const PHILOSOPHY_PARAGRAPHS = [
  "Fotboll kan skapa glädje, men den kan inte ensam göra ett barn lyckligt. Däremot kan den ge barnet en plats att längta till, vänner att växa tillsammans med och modet att försöka igen efter ett misslyckande. Den kan skapa gemenskap och minnen som följer med genom livet. Därför är den viktigaste segern inte alltid att vinna matchen – utan att varje barn går hem och längtar till nästa fotbollsupplevelse.",
  "För att det ska bli möjligt krävs trygga och engagerade vuxna. Vuxna som ser varje barn, skapar gemenskap och låter glädje, lärande och utveckling gå hand i hand. Det är ett stort och viktigt uppdrag – men ingen tränare ska behöva klara det ensam.",
  "Fotbollsrummet är stödet för de vuxna runt barnens fotboll. Här finns kunskap, inspiration och praktiska verktyg som gör det enklare att planera träningar, förklara spelet och skapa meningsfulla fotbollsupplevelser för varje barn.",
  "För även om fotboll på planen självklart handlar om att försöka vinna, handlar fotbollen utanför planen om något större:",
];

export function Landing() {
  const [showPhilosophy, setShowPhilosophy] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14 sm:py-20">
      <section className="flex flex-col items-start">
        <BrandLogo size={56} showName={false} />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {BRAND_EYEBROW}
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">
          {BRAND_NAME}
        </h1>
        <p className="mt-3 font-display text-xl font-semibold text-foreground sm:text-2xl">
          {BRAND_TAGLINE}
        </p>
        <p className="mt-4 max-w-2xl text-muted-foreground">{BRAND_INTRO}</p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Kom igång
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Logga in</Link>
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setShowPhilosophy(true)}
          aria-haspopup="dialog"
        >
          <Heart className="size-5 text-primary" aria-hidden />
          Vår filosofi
        </Button>
      </section>

      <Dialog open={showPhilosophy} onOpenChange={setShowPhilosophy}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <Heart className="size-6 text-primary" aria-hidden />
              Vår filosofi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-foreground/90 leading-relaxed">
            {PHILOSOPHY_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="font-display text-lg font-semibold text-primary">
              ”Så många som möjligt, så länge som möjligt, så bra som möjligt.”
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Allt du behöver för laget</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="glass-card rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50"
            >
              <feature.icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-lg font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
