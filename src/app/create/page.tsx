import type { Metadata } from "next";
import { CreateFlow } from "@/components/create/create-flow";
export const metadata: Metadata = { title: "Create Token" };
export default function CreatePage() {
  return <CreateFlow />;
}
