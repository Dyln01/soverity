import { CreatePassForm } from "./CreatePassForm"

export const metadata = {
  title: "Create your Soverity Pass",
}

export default function CreatePassPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center px-6 py-12">
      <div className="w-full">
        <CreatePassForm />
      </div>
    </div>
  )
}
