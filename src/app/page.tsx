import { DatasheetIntakeWorkbench } from "@/components/datasheet-intake-workbench";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 sm:px-8 md:py-12">
        <DatasheetIntakeWorkbench />
      </div>
    </main>
  );
}
