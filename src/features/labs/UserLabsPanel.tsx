import { UserEntriesPanel } from "@/components/hnhh/UserEntriesPanel";

export function UserLabsPanel() {
  return (
    <UserEntriesPanel
      storageKey="hnhh.userLabs.v1"
      labels={{
        cardTitle: "My lab entries",
        cardDescription: "Log lab work by date or upload your own reports.",
        addButton: "Add lab entry",
        uploadButton: "Upload file",
        addDialogTitle: "Add lab work",
        addDialogDescription: "All results under one date are grouped together.",
        uploadDialogTitle: "Upload lab file",
        uploadDialogDescription: "PDF, image, or document — up to 5 MB.",
        itemLabel: "Lab work",
        itemPlaceholder: "e.g. TSH, Ferritin, Vitamin D",
        resultLabel: "Results",
        resultPlaceholder: "e.g. 2.1 mIU/L",
        addAnother: "Add another lab work",
        emptyState: "N/A — no entries yet. Click Add lab entry or Upload file to start.",
        tableItemHeader: "Lab work",
        tableResultHeader: "Results",
      }}
    />
  );
}
