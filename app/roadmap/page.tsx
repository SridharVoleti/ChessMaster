import { redirect } from 'next/navigation'

// The roadmap is the home screen now (app/page.tsx). Keep this path
// working for existing links / bookmarks.
export default function RoadmapRedirect() {
  redirect('/')
}
