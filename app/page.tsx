/* eslint-disable react/no-unescaped-entities */
import Image from "next/image";
import { homeContent } from '../public/content/text/landing';

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{homeContent.title}</h1>
      <p className="mb-4">{homeContent.introduction}</p>
      {homeContent.images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {homeContent.images.map((image, index) => (
            <Image 
              key={index}
              src={image.src} 
              alt={image.alt} 
              width={300} 
              height={200} 
              className="rounded-lg" 
            />
          ))}
        </div>
      )}
      <p>{homeContent.additionalContent}</p>
    </div>
  );
}