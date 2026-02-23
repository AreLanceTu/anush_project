const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'MatchesFemale.html'),
  path.join(__dirname, '..', 'public', 'MatchesFemale.html'),
];

const profiles = [
  { name: 'Aarav Sharma', city: 'Mumbai', job: 'Software Engineer', bio: 'Enjoys weekend drives, fitness, and street photography.' },
  { name: 'Vivaan Verma', city: 'Delhi', job: 'Doctor', bio: 'Calm and family-oriented. Loves reading, gym, and volunteering.' },
  { name: 'Kabir Singh', city: 'Bengaluru', job: 'Marketing Manager', bio: 'Foodie and traveler. Enjoys trekking and discovering new cafés.' },
  { name: 'Arjun Nair', city: 'Kochi', job: 'Data Analyst', bio: 'Likes music, badminton, and beach walks. Loves simple weekends.' },
  { name: 'Ishaan Gupta', city: 'Hyderabad', job: 'HR Manager', bio: 'People person. Enjoys books, yoga, and evening walks.' },
  { name: 'Rohan Mehta', city: 'Pune', job: 'Graphic Designer', bio: 'Creative and curious. Loves sketching, indie music, and coffee.' },
  { name: 'Aditya Joshi', city: 'Ahmedabad', job: 'Chartered Accountant', bio: 'Enjoys cricket, finance podcasts, and travel with family.' },
  { name: 'Siddharth Kapoor', city: 'Jaipur', job: 'Architect', bio: 'Loves design, heritage walks, and architectural photography.' },
  { name: 'Pranav Reddy', city: 'Vijayawada', job: 'Pharmacist', bio: 'Enjoys cooking, badminton, and movies. Loves road trips.' },
  { name: 'Kunal Desai', city: 'Surat', job: 'Interior Designer', bio: 'Into décor, films, and café hopping. Likes trying new recipes.' },
  { name: 'Nikhil Kumar', city: 'Lucknow', job: 'Content Writer', bio: 'Avid reader and foodie. Loves poetry and weekend getaways.' },
  { name: 'Saurabh Mishra', city: 'Bhopal', job: 'Civil Engineer', bio: 'Enjoys cricket, trekking, and long road trips.' },
  { name: 'Farhan Khan', city: 'Kolkata', job: 'Journalist', bio: 'Storyteller at heart. Enjoys documentaries and photo-walks.' },
  { name: 'Rahul Iyer', city: 'Chennai', job: 'Product Manager', bio: 'Tech + travel. Loves cycling, startups, and good coffee.' },
  { name: 'Vijay Malhotra', city: 'Gurgaon', job: 'Business Analyst', bio: 'Enjoys analytics, gym, and weekend cricket matches.' },
  { name: 'Ankit Chatterjee', city: 'Kolkata', job: 'UX Designer', bio: 'Design-minded. Loves music, reading, and long walks.' },
  { name: 'Manav Bansal', city: 'Noida', job: 'Software Developer', bio: 'Enjoys coding, gaming, and late-night chai with friends.' },
  { name: 'Ritesh Saini', city: 'Jaipur', job: 'Operations Lead', bio: 'Organized and optimistic. Loves cooking and short trips.' },
  { name: 'Harsh Vardhan', city: 'Patna', job: 'Mechanical Engineer', bio: 'Enjoys fitness, bike rides, and weekend movies.' },
  { name: 'Sameer Qureshi', city: 'Bhopal', job: 'Financial Analyst', bio: 'Enjoys investing, football, and evening walks.' },
  { name: 'Deepak Shetty', city: 'Mangaluru', job: 'Chef', bio: 'Food lover. Enjoys experimenting with recipes and beach runs.' },
  { name: 'Omkar Patil', city: 'Nashik', job: 'Government Officer', bio: 'Family-first. Enjoys reading, travel, and hiking.' },
  { name: 'Yash Rajput', city: 'Indore', job: 'Photographer', bio: 'Loves portraits, travel reels, and street food hunts.' },
  { name: 'Tanmay Kulkarni', city: 'Pune', job: 'Data Scientist', bio: 'Enjoys AI, running, and board games on weekends.' },
  { name: 'Shubham Tiwari', city: 'Kanpur', job: 'Banker', bio: 'Enjoys finance, music, and family time. Loves chai.' },
  { name: 'Karthik Ramanan', city: 'Chennai', job: 'Biotechnologist', bio: 'Science lover. Enjoys documentaries, gyms, and music.' },
  { name: 'Mohit Jain', city: 'Meerut', job: 'Lawyer', bio: 'Enjoys reading, swimming, and weekend trips.' },
  { name: 'Rajat Arora', city: 'Delhi', job: 'Event Manager', bio: 'Loves planning, music festivals, and photography.' },
  { name: 'Naveen Reddy', city: 'Hyderabad', job: 'Dentist', bio: 'Calm and caring. Enjoys badminton and cooking.' },
  { name: 'Prateek Saxena', city: 'Lucknow', job: 'Research Analyst', bio: 'Enjoys quizzes, books, and weekend treks.' },
  { name: 'Abhishek Nayak', city: 'Bhubaneswar', job: 'Civil Engineer', bio: 'Enjoys site work, cricket, and long drives.' },
  { name: 'Gaurav Kapoor', city: 'Jodhpur', job: 'Fashion Designer', bio: 'Stylish and fun. Loves sketching outfits and music.' },
  { name: 'Sandeep Rao', city: 'Mysuru', job: 'Teacher', bio: 'Enjoys books, gardening, and calm conversations.' },
  { name: 'Imran Shaikh', city: 'Ahmedabad', job: 'Travel Blogger', bio: 'Globetrotter. Enjoys photography and adventure sports.' },
  { name: 'Armaan Ali', city: 'Ranchi', job: 'HR Executive', bio: 'People person. Enjoys music, movies, and trekking.' },
  { name: 'Dhruv Deshpande', city: 'Nagpur', job: 'Entrepreneur', bio: 'Startup enthusiast. Loves networking and reading.' },
  { name: 'Vikas Yadav', city: 'Varanasi', job: 'Investment Banker', bio: 'Enjoys markets, music, and weekend food festivals.' },
  { name: 'Pranesh Menon', city: 'Thiruvananthapuram', job: 'Software Tester', bio: 'Tech enthusiast. Enjoys cycling and puzzles.' },
  { name: 'Tejas Shah', city: 'Vadodara', job: 'Nutritionist', bio: 'Health-focused. Enjoys yoga, cooking, and nature walks.' },
  { name: 'Sarthak Gupta', city: 'Guwahati', job: 'Airline Pilot', bio: 'Loves travel, fitness, and trying local food.' },
  { name: 'Naman Bhatia', city: 'Amritsar', job: 'Startup Founder', bio: 'Builder mindset. Enjoys books, podcasts, and runs.' },
  { name: 'Lakshya Chauhan', city: 'Rajkot', job: 'Professor', bio: 'Enjoys teaching, classical music, and gardening.' },
  { name: 'Faraz Siddiqui', city: 'Raipur', job: 'Artist', bio: 'Loves sketching, music, and weekend café hopping.' },
];

function updateFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  const cardRegex = /<article\b[^>]*class="card[^"]*"[^>]*>[\s\S]*?<\/article>/g;
  let index = 0;

  const updated = original.replace(cardRegex, (cardHtml) => {
    const profile = profiles[index % profiles.length];
    index += 1;

    let next = cardHtml;

    next = next.replace(/(<div class="name">)([^<]*?)(\s*<span class="meta">)/, `$1${profile.name}$3`);
    next = next.replace(/(<div class="location">)([^<]*)(<\/div>)/, `$1${profile.city}$3`);
    next = next.replace(/(<div class="profession">)([^<]*)(<\/div>)/, `$1${profile.job}$3`);
    next = next.replace(/(<p class="bio">)([^<]*)(<\/p>)/, `$1${profile.bio}$3`);

    return next;
  });

  fs.writeFileSync(filePath, updated, 'utf8');
  return { filePath, cardsUpdated: index };
}

const results = [];
for (const target of targets) {
  if (fs.existsSync(target)) {
    results.push(updateFile(target));
  }
}

for (const r of results) {
  // eslint-disable-next-line no-console
  console.log(`${path.relative(path.join(__dirname, '..'), r.filePath)}: updated ${r.cardsUpdated} cards`);
}
