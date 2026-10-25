import type { HousingProfileDraft, Lifestyle } from './types'
export const sections = ['Housing basics', 'Your ideal home', 'Amenities', 'Your lifestyle', 'Roommate preferences', 'Personal priorities']
export const headings = ["Let's find a place that feels like home.", 'What does your ideal home look like?', 'What makes a space feel like yours?', 'Tell us what living with you is like.', 'What matters most in a roommate?', "Let's make your search yours."]
export const housingTypes = ['Apartment', 'House', 'Townhouse', 'Studio', 'Shared house', 'Student housing']
export const amenities = [
  ['❄', 'Central air conditioning'], ['☀', 'Heating'], ['✣', 'Ceiling fans'], ['◒', 'Natural lighting'],
  ['◇', 'Dishwasher'], ['♧', 'Full kitchen'], ['▣', 'Refrigerator'], ['♨', 'Oven/stove'], ['▤', 'Microwave'],
  ['◉', 'In-unit washer and dryer'], ['◎', 'Shared laundry'], ['P', 'Parking'], ['▱', 'Covered parking'],
  ['⌁', 'High-speed internet'], ['↗', 'Gym'], ['≈', 'Pool'], ['▥', 'Study rooms'], ['❀', 'Balcony or patio'],
  ['♧', 'Outdoor space'], ['⌂', 'Secure building access'], ['↕', 'Elevator'], ['♡', 'Pet-friendly housing'],
  ['♿', 'Accessible entrances and facilities'],
]
export const lifestyleQuestions: { key: keyof Lifestyle; label: string; options: string[] }[] = [
  {key:'sleep', label:'When do you recharge?', options:['Early bird','Night owl','Flexible']},
  {key:'cleanliness', label:'How tidy is your space?', options:['Very organized','Moderately tidy','Relaxed']},
  {key:'noise', label:'Your ideal noise level', options:['Quiet','Moderate','Lively']},
  {key:'social', label:'How do you spend time at home?', options:['Introverted','Balanced','Social']},
  {key:'guests', label:'How often do you have guests?', options:['Rarely','Occasionally','Frequently']},
  {key:'overnight', label:'How do you feel about overnight guests?', options:['Comfortable','Sometimes','Uncomfortable']},
  {key:'work', label:'How often do you study or work at home?', options:['Frequently at home','Occasionally','Rarely']},
  {key:'smoking', label:'Smoking preferences', options:['Non-smoker','Smoker','Prefer smoke-free home']},
  {key:'pets', label:'Pets in your home', options:['Have pets','Comfortable with pets','Prefer no pets']},
  {key:'groceries', label:'Sharing the fridge', options:['Share groceries','Separate groceries','No preference']},
  {key:'cleaning', label:'How should cleaning work?', options:['Weekly schedule','Clean as needed','Individual responsibilities']},
  {key:'communication', label:'How do you like to communicate?', options:['Direct communication','Group discussions','Text messages','Flexible']},
]
export const compatibility = ['Cleanliness compatibility','Sleep schedule compatibility','Noise compatibility','Guest frequency','Smoking compatibility','Pet compatibility','Communication style','Shared responsibilities','Social habits','Personal boundaries']
export const dealbreakers = ['Smoking indoors','Pets in the home','Frequent overnight guests','Late-night noise','Unshared cleaning responsibilities','Shared groceries','Unannounced guests']
export const priorityOptions = ['Affordability','Distance to campus/work','Walkability','Public transportation','Apartment size','Private bathroom','In-unit laundry','Pet-friendly housing','Parking','Natural lighting','Quiet environment','Accessibility','Amenities','Roommate compatibility']
export function createHousingProfile(): HousingProfileDraft {
  return { version:1, step:0, completed:false, updatedAt:new Date().toISOString(), profile:{
    housingBasics:{city:'',state:'VA',neighborhoods:'',proximity:'',commuteArea:'',commute:30,transportation:'',minRent:500,maxRent:1500,totalBudget:1800,utilities:'',budgetFlexible:'',moveInDate:'',dateFlexible:'',lease:'',otherLease:''},
    propertyPreferences:{housingTypes:[],bedrooms:1,bathrooms:1,bedroom:'',bathroom:'',squareFootage:0,furnishing:'',floor:'',elevator:'',roommates:1,entrance:'',outdoor:''},
    amenities:Object.fromEntries(amenities.map(([,name])=>[name,"Don't care"])),
    lifestyle:{sleep:'',cleanliness:'',noise:'',social:'',guests:'',overnight:'',work:'',smoking:'',pets:'',groceries:'',cleaning:'',communication:''},
    roommatePreferences:{importance:Object.fromEntries(compatibility.map(name=>[name,3])),dealbreakers:[]}, priorities:{ranked:[],flexible:[]}
  }}
}
