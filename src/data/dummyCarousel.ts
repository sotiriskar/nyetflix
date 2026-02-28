import type { CarouselItem } from '../components/Carousel';
import type { MovieDetail } from '../types/movie';

// Shared dummy items for carousels (in a real app these would come from your library/API)
const DUMMY_ITEMS: CarouselItem[] = [
  { id: '1', title: 'The Great Adventure' },
  { id: '2', title: 'Midnight in Paris' },
  { id: '3', title: 'Space Odyssey' },
  { id: '4', title: 'The Last Frontier' },
  { id: '5', title: 'Echoes of Tomorrow' },
  { id: '6', title: 'City of Lights' },
  { id: '7', title: 'Winter Tales' },
  { id: '8', title: 'Summer Dreams' },
];

// Max 8 movies per carousel
export const HOME_CAROUSELS = [
  { title: 'New Files', items: DUMMY_ITEMS.slice(0, 8) },
  { title: 'Continue Watching', items: DUMMY_ITEMS.slice(1, 6) },
  { title: 'Comedy', items: DUMMY_ITEMS.slice(0, 8) },
  { title: 'Drama', items: DUMMY_ITEMS.slice(2, 8) },
];

// Detail data for the modal (keyed by id)
export const MOVIE_DETAILS: Record<string, MovieDetail> = {
  '1': {
    id: '1',
    title: 'The Great Adventure',
    description:
      "When a mysterious signal appears from the depths of space, a team of explorers must journey beyond everything they know to save humanity. A story of courage, sacrifice and the bonds that hold us together.",
    year: '2023',
    contentRating: '16+',
    cast: 'Richard Armitage, Charlie Murphy, Indira Varma, more',
    genres: 'British, TV Programmes Based on Books, TV Thrillers',
    tags: 'Steamy, Suspenseful',
    duration: '145m',
    progress: 0.05,
  },
  '2': {
    id: '2',
    title: 'Midnight in Paris',
    description: 'A screenwriter finds himself mysteriously transported to 1920s Paris each night, where he falls in love and discovers the city at its most vibrant.',
    year: '2022',
    contentRating: '12+',
    cast: 'Owen Wilson, Rachel McAdams, Marion Cotillard, more',
    genres: 'Romance, Fantasy, Comedy',
    tags: 'Romantic, Whimsical',
    duration: '94m',
    progress: 0,
  },
  '3': {
    id: '3',
    title: 'Space Odyssey',
    description: 'Humanity\'s first manned mission to the outer solar system uncovers secrets that challenge everything we know about life and time.',
    year: '2024',
    contentRating: '16+',
    cast: 'TBA, more',
    genres: 'Sci-Fi, Drama, Adventure',
    tags: 'Mind-bending, Epic',
    duration: '128m',
    progress: 0.2,
  },
  '4': {
    id: '4',
    title: 'The Last Frontier',
    description: 'In a frozen wasteland, a lone survivor must cross hundreds of miles to reach the last known outpost of civilisation.',
    year: '2023',
    contentRating: '16+',
    genres: 'Survival, Drama, Thriller',
    tags: 'Gritty, Tense',
    duration: '112m',
    progress: 0,
  },
  '5': {
    id: '5',
    title: 'Echoes of Tomorrow',
    description: 'A scientist discovers a way to send messages to the past, with consequences that ripple through time and memory.',
    year: '2023',
    contentRating: '12+',
    genres: 'Sci-Fi, Drama',
    tags: 'Thought-provoking',
    duration: '105m',
    progress: 0.5,
  },
  '6': {
    id: '6',
    title: 'City of Lights',
    description: 'Three strangers in Paris find their lives intertwined over one unforgettable night.',
    year: '2022',
    contentRating: '16+',
    genres: 'Drama, Romance',
    tags: 'Emotional, Romantic',
    duration: '98m',
    progress: 0,
  },
  '7': {
    id: '7',
    title: 'Winter Tales',
    description: 'A collection of stories set in a small town during the coldest winter in decades.',
    year: '2023',
    contentRating: '12+',
    genres: 'Drama, Anthology',
    tags: 'Heartwarming',
    duration: '180m',
    progress: 0.1,
  },
  '8': {
    id: '8',
    title: 'Summer Dreams',
    description: 'A group of friends reunites at a beach house for one last summer before adulthood pulls them apart.',
    year: '2024',
    contentRating: '12+',
    genres: 'Comedy, Drama, Romance',
    tags: 'Nostalgic, Feel-good',
    duration: '88m',
    progress: 0,
  },
};

export function getMovieDetail(id: string): MovieDetail | undefined {
  return MOVIE_DETAILS[id];
}
