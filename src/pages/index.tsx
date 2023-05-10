import { GetServerSideProps } from 'next';

export default function Watch() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.writeHead(302, { Location: '/browse' });
  res.end();

  return { props: {} };
};