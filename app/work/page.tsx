import Image from 'next/image';
import { workContent, companyIcons } from '../../public/content/text/work';

export default function Work() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{workContent.title}</h1>
      <p className="mb-4">{workContent.introduction}</p>
      
      {workContent.experiences.map((experience, index) => (
        <section key={index} className="mb-8">
          <div className="flex items-center mb-2">
            {companyIcons[experience.company] && (
              <Image
                src={companyIcons[experience.company]}
                alt={`${experience.company} logo`}
                width={50}
                height={50}
                className="mr-2" />
            )}
            <h2 className="text-2xl font-bold ml-4">{experience.company}</h2>
          </div>
          <p className="text-600 mb-2">{experience.position}</p>
          <p className="mb-4">{experience.description}</p>
          <ul className="list-disc pl-5">
            {experience.achievements.map((achievement, achievementIndex) => (
              <li key={achievementIndex}>{achievement}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}