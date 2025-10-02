import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Users, Calendar, ArrowLeft } from "lucide-react";

export interface AcademicSelection {
  year: string;
  field: string;
  course: string;
}

interface Props {
  onSelectionComplete: (selection: AcademicSelection) => void;
}

type Item = { id: string; name: string; description: string };

// const API_BASE = import.meta.env.VITE_API_BASE ?? ""; // ex: "http://localhost:8010"
const API_BASE = "http://localhost:8010";
export const AcademicSelector = ({ onSelectionComplete }: Props) => {
  // Étapes & sélection (UI inchangée)
  const [step, setStep] = useState<'year' | 'field' | 'course'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('');   // correspond en réalité au "major"
  const [selectedField, setSelectedField] = useState<string>(''); // correspond en réalité à l'année côté backend
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // On garde la même structure que l'ancien mock pour ne pas toucher l'UI :
  const [data, setData] = useState<{
    years: Item[];                                     // affichera les "majors"
    fields: Record<string, Item[]>;                    // par major → années
    courses: Record<string, Item[]>;                   // par `${major}-${year}` → cours
  }>({
    years: [],
    fields: {},
    courses: {},
  });

  // Chargement initial : majors -> injectés dans "years" pour conserver l’UI
  useEffect(() => {
    const loadMajors = async () => {
      try {
        const res = await fetch(`${API_BASE}/major`);
        const json = await res.json();
        const majors: string[] = json?.majors ?? [];
        const yearsItems: Item[] = majors.map((m) => ({
          id: m,
          name: m,               // on affiche tel quel (UI inchangée)
          description: "",       // tu pourras enrichir plus tard
        }));
        setData((prev) => ({ ...prev, years: yearsItems }));
      } catch (e) {
        console.error("Failed to load majors:", e);
        setData((prev) => ({ ...prev, years: [] }));
      }
    };
    loadMajors();
  }, []);

  // Sélection d'une "année" (UI) → en réalité un MAJOR
  const handleYearSelect = async (yearId: string) => {
    setSelectedYear(yearId);
    // Précharger les "fields" (années par major) avant d'aller à l'étape suivante
    if (!data.fields[yearId]) {
      try {
        const res = await fetch(`${API_BASE}/year/${encodeURIComponent(yearId)}`);
        const json = await res.json();
        const years: string[] = json?.years ?? [];
        const fieldItems: Item[] = years.map((y) => ({
          id: y,
          name: `Année ${y}`,   // étiquette lisible
          description: "",
        }));
        setData((prev) => ({
          ...prev,
          fields: { ...prev.fields, [yearId]: fieldItems },
        }));
      } catch (e) {
        console.error("Failed to load years for major:", e);
        setData((prev) => ({
          ...prev,
          fields: { ...prev.fields, [yearId]: [] },
        }));
      }
    }
    setStep('field');
  };

  // Sélection d'une "filière" (UI) → en réalité l’ANNÉE (ex: "3")
  const handleFieldSelect = async (fieldId: string) => {
    setSelectedField(fieldId);
    const key = `${selectedYear}-${fieldId}`;
    // Précharger les cours pour (major, year)
    if (!data.courses[key]) {
      try {
        const res = await fetch(`${API_BASE}/course/${encodeURIComponent(selectedYear)}/${encodeURIComponent(fieldId)}`);
        const json = await res.json();
        const courses: string[] = json?.courses ?? [];
        const courseItems: Item[] = courses.map((c) => ({
          id: c,
          name: c,
          description: "",
        }));
        setData((prev) => ({
          ...prev,
          courses: { ...prev.courses, [key]: courseItems },
        }));
      } catch (e) {
        console.error("Failed to load courses:", e);
        setData((prev) => ({
          ...prev,
          courses: { ...prev.courses, [key]: [] },
        }));
      }
    }
    setStep('course');
  };

  // Sélection d’un cours (UI inchangée)
  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);

    const yearData = data.years.find((y) => y.id === selectedYear);
    const fieldData = data.fields[selectedYear]?.find((f) => f.id === selectedField);
    const courseData = data.courses[`${selectedYear}-${selectedField}`]?.find((c) => c.id === courseId);

    if (yearData && fieldData && courseData) {
      onSelectionComplete({
        year: fieldData.name,   // affichage lisible (ex: "Année 3")
        field: yearData.name,   // le major choisi (ex: "SI")
        course: courseData.name,
      });
    }
  };

  // ==== UI INCHANGÉE CI-DESSOUS ====

  const renderYearSelection = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-accent rounded-full mb-4">
          <Calendar className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Choisissez votre année d'études</h2>
        <p className="text-muted-foreground">Sélectionnez votre niveau académique actuel</p>
      </div>

      <div className="grid gap-4 max-w-2xl mx-auto max-h-[60vh] overflow-y-auto pr-2">
        {data.years.map((year) => (
          <Card
            key={year.id}
            className="p-6 cursor-pointer transition-all hover:shadow-medium hover:bg-secondary/30 backdrop-blur-sm border-border/50 bg-card/50"
            onClick={() => handleYearSelect(year.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{year.name}</h3>
                <p className="text-sm text-muted-foreground">{year.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderFieldSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-4">
        <Button
          variant="ghost"
          onClick={() => setStep('year')}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Badge variant="secondary" className="bg-secondary/50 backdrop-blur-sm text-secondary-foreground">
          {data.years.find(y => y.id === selectedYear)?.name}
        </Badge>
      </div>

      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-accent rounded-full mb-4">
          <Users className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Choisissez votre filière</h2>
        <p className="text-muted-foreground">Sélectionnez votre domaine d'études</p>
      </div>

      <div className="grid gap-4 max-w-2xl mx-auto max-h-[60vh] overflow-y-auto pr-2">
        {data.fields[selectedYear]?.map((field) => (
          <Card
            key={field.id}
            className="p-6 cursor-pointer transition-all hover:shadow-medium hover:bg-secondary/30 backdrop-blur-sm border-border/50 bg-card/50"
            onClick={() => handleFieldSelect(field.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{field.name}</h3>
                <p className="text-sm text-muted-foreground">{field.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCourseSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-4">
        <Button
          variant="ghost"
          onClick={() => setStep('field')}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex gap-2">
          <Badge variant="secondary" className="bg-secondary/50 backdrop-blur-sm text-secondary-foreground">
            {data.years.find(y => y.id === selectedYear)?.name}
          </Badge>
          <Badge variant="secondary" className="bg-secondary/50 backdrop-blur-sm text-secondary-foreground">
            {data.fields[selectedYear]?.find(f => f.id === selectedField)?.name}
          </Badge>
        </div>
      </div>

      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-accent rounded-full mb-4">
          <BookOpen className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Choisissez votre cours</h2>
        <p className="text-muted-foreground">Sélectionnez la matière pour laquelle vous souhaitez de l'aide</p>
      </div>

      <div className="grid gap-4 max-w-2xl mx-auto max-h-[60vh] overflow-y-auto pr-2">
        {data.courses[`${selectedYear}-${selectedField}`]?.map((course) => (
          <Card
            key={course.id}
            className="p-6 cursor-pointer transition-all hover:shadow-medium hover:bg-secondary/30 backdrop-blur-sm border-border/50 bg-card/50"
            onClick={() => handleCourseSelect(course.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{course.name}</h3>
                <p className="text-sm text-muted-foreground">{course.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-hidden">
      <div className="w-full max-w-4xl">
        {step === 'year' && renderYearSelection()}
        {step === 'field' && renderFieldSelection()}
        {step === 'course' && renderCourseSelection()}
      </div>
    </div>
  );
};
