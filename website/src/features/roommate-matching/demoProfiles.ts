import { createHousingProfile } from '../housing-profile'
import type { HousingProfileData } from '../housing-profile'

export interface FictionalRoommate {
  id: string
  name: string
  initials: string
  tagline: string
  matchProfile: MatchProfile
  profile: HousingProfileData
}

export interface MatchProfile {
  roommateDynamic: 'Friendly & communal' | 'Independent' | 'Study-focused' | 'Balanced'
  householdRhythm: 'Quiet & private' | 'Social & communal' | 'Balanced'
  sharedMeals: 'Often' | 'Sometimes' | 'Separate'
  homeLanguages: string[]
  culturalNotes: string[]
  kitchenStyle: 'Vegetarian-friendly' | 'Allergy-aware' | 'No restrictions'
}

type DemoOverrides = {
  basics?: Partial<HousingProfileData['housingBasics']>
  property?: Partial<HousingProfileData['propertyPreferences']>
  lifestyle?: Partial<HousingProfileData['lifestyle']>
  importance?: Record<string, number>
  dealbreakers?: string[]
  match?: Partial<MatchProfile>
}

function demo(id: string, name: string, tagline: string, overrides: DemoOverrides): FictionalRoommate {
  const base = createHousingProfile().profile
  return {
    id,
    name,
    initials: name.split(' ').map(part => part[0]).join(''),
    tagline,
    matchProfile: {
      roommateDynamic: 'Balanced',
      householdRhythm: 'Balanced',
      sharedMeals: 'Sometimes',
      homeLanguages: ['English'],
      culturalNotes: [],
      kitchenStyle: 'No restrictions',
      ...overrides.match,
    },
    profile: {
      ...base,
      housingBasics: {
        ...base.housingBasics,
        city: 'Boston', state: 'MA', minRent: 850, maxRent: 1450,
        moveInDate: '2027-01-01', lease: '12 months', transportation: 'Public transit',
        ...overrides.basics,
      },
      propertyPreferences: {
        ...base.propertyPreferences,
        housingTypes: ['Apartment', 'Shared house'],
        ...overrides.property,
      },
      lifestyle: { ...base.lifestyle, ...overrides.lifestyle },
      roommatePreferences: {
        importance: { ...base.roommatePreferences.importance, ...overrides.importance },
        dealbreakers: overrides.dealbreakers ?? [],
      },
    },
  }
}

export const fictionalRoommates: FictionalRoommate[] = [
  demo('maya', 'Maya Chen', 'Quiet mornings, shared dinners, and a very tidy kitchen.', { match:{roommateDynamic:'Friendly & communal',householdRhythm:'Quiet & private',sharedMeals:'Often',homeLanguages:['English','Mandarin'],culturalNotes:['Shoes-off home','Family video calls'],kitchenStyle:'Allergy-aware'}, lifestyle: { sleep:'Early bird',cleanliness:'Very organized',noise:'Quiet',social:'Balanced',guests:'Occasionally',overnight:'Sometimes',work:'Frequently at home',smoking:'Prefer smoke-free home',pets:'Comfortable with pets',groceries:'Share groceries',cleaning:'Weekly schedule',communication:'Direct communication' }, importance:{'Noise compatibility':5,'Cleanliness compatibility':5}, dealbreakers:['Smoking indoors','Late-night noise'] }),
  demo('jordan', 'Jordan Brooks', 'A social night owl who keeps common spaces relaxed.', { match:{roommateDynamic:'Friendly & communal',householdRhythm:'Social & communal',sharedMeals:'Separate',culturalNotes:['Game nights'],kitchenStyle:'No restrictions'}, basics:{maxRent:1250}, lifestyle:{sleep:'Night owl',cleanliness:'Relaxed',noise:'Lively',social:'Social',guests:'Frequently',overnight:'Comfortable',work:'Rarely',smoking:'Non-smoker',pets:'Have pets',groceries:'Separate groceries',cleaning:'Clean as needed',communication:'Group discussions'}, dealbreakers:['Unshared cleaning responsibilities'] }),
  demo('priya', 'Priya Nair', 'Grad-student rhythm, calm evenings, clear communication.', { match:{roommateDynamic:'Study-focused',householdRhythm:'Quiet & private',sharedMeals:'Sometimes',homeLanguages:['English','Hindi'],culturalNotes:['Vegetarian kitchen preferred','Festival-friendly home'],kitchenStyle:'Vegetarian-friendly'}, basics:{minRent:1000,maxRent:1600}, lifestyle:{sleep:'Flexible',cleanliness:'Moderately tidy',noise:'Quiet',social:'Introverted',guests:'Rarely',overnight:'Uncomfortable',work:'Frequently at home',smoking:'Prefer smoke-free home',pets:'Prefer no pets',groceries:'Separate groceries',cleaning:'Weekly schedule',communication:'Direct communication'}, importance:{'Personal boundaries':5,'Noise compatibility':5}, dealbreakers:['Pets in the home','Frequent overnight guests'] }),
  demo('leo', 'Leo Martinez', 'Friendly, flexible, and usually out exploring the city.', { match:{roommateDynamic:'Balanced',householdRhythm:'Social & communal',sharedMeals:'Sometimes',homeLanguages:['English','Spanish'],culturalNotes:['Friends-and-family dinners'],kitchenStyle:'No restrictions'}, basics:{city:'Cambridge',maxRent:1500,moveInDate:'2027-02-01'}, lifestyle:{sleep:'Flexible',cleanliness:'Moderately tidy',noise:'Moderate',social:'Social',guests:'Occasionally',overnight:'Sometimes',work:'Rarely',smoking:'Non-smoker',pets:'Comfortable with pets',groceries:'No preference',cleaning:'Clean as needed',communication:'Flexible'} }),
  demo('sam', 'Sam Rivera', 'Creative homebody seeking a considerate shared routine.', { match:{roommateDynamic:'Friendly & communal',householdRhythm:'Balanced',sharedMeals:'Often',homeLanguages:['English','Spanish'],culturalNotes:['Creative projects at home'],kitchenStyle:'Vegetarian-friendly'}, basics:{minRent:700,maxRent:1150,lease:'6 months'}, lifestyle:{sleep:'Night owl',cleanliness:'Moderately tidy',noise:'Moderate',social:'Balanced',guests:'Occasionally',overnight:'Sometimes',work:'Frequently at home',smoking:'Non-smoker',pets:'Have pets',groceries:'Share groceries',cleaning:'Individual responsibilities',communication:'Text messages'}, dealbreakers:['Smoking indoors','Unannounced guests'] }),
  demo('aisha', 'Aisha Grant', 'Early riser who values privacy and dependable chores.', { match:{roommateDynamic:'Independent',householdRhythm:'Quiet & private',sharedMeals:'Separate',homeLanguages:['English'],culturalNotes:['Quiet reflection time','Shoes-off home'],kitchenStyle:'No restrictions'}, lifestyle:{sleep:'Early bird',cleanliness:'Very organized',noise:'Quiet',social:'Introverted',guests:'Rarely',overnight:'Uncomfortable',work:'Occasionally',smoking:'Prefer smoke-free home',pets:'Prefer no pets',groceries:'Separate groceries',cleaning:'Weekly schedule',communication:'Direct communication'}, importance:{'Shared responsibilities':5,'Personal boundaries':5}, dealbreakers:['Pets in the home','Shared groceries'] }),
  demo('noah', 'Noah Williams', 'Easygoing commuter with flexible home habits.', { match:{roommateDynamic:'Independent',householdRhythm:'Balanced',sharedMeals:'Separate',culturalNotes:['Weekend sports'],kitchenStyle:'No restrictions'}, basics:{city:'Somerville',minRent:900,maxRent:1350}, lifestyle:{sleep:'Flexible',cleanliness:'Relaxed',noise:'Moderate',social:'Balanced',guests:'Occasionally',overnight:'Sometimes',work:'Occasionally',smoking:'Non-smoker',pets:'Comfortable with pets',groceries:'No preference',cleaning:'Clean as needed',communication:'Flexible'} }),
  demo('elena', 'Elena Park', 'Organized, communicative, and happy to share responsibilities.', { match:{roommateDynamic:'Balanced',householdRhythm:'Quiet & private',sharedMeals:'Often',homeLanguages:['English','Korean'],culturalNotes:['Shared meals welcome','Shoes-off home'],kitchenStyle:'Allergy-aware'}, basics:{minRent:1100,maxRent:1700}, property:{housingTypes:['Apartment','Townhouse']}, lifestyle:{sleep:'Early bird',cleanliness:'Very organized',noise:'Quiet',social:'Balanced',guests:'Occasionally',overnight:'Sometimes',work:'Occasionally',smoking:'Prefer smoke-free home',pets:'Comfortable with pets',groceries:'Share groceries',cleaning:'Weekly schedule',communication:'Group discussions'}, importance:{'Communication style':5,'Shared responsibilities':5}, dealbreakers:['Smoking indoors'] }),
]
