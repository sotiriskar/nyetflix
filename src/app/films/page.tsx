import { redirect } from 'next/navigation';

export default function FilmsRedirect() {
  redirect('/browse/films');
}
