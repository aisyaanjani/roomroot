import { filterCities } from './locationData'
import { sections } from './questions'
import type { HousingProfileData } from './types'
import { validateSection } from './validation'

export const importanceLabels: Record<number, string> = {
  1: 'Barely matters',
  2: 'Nice to align',
  3: 'Worth discussing',
  4: 'Important',
  5: 'Essential to daily comfort',
}

export interface ProfileReviewItem {
  section: number
  message: string
}

export interface ProfileReview {
  blocking: ProfileReviewItem[]
  suggestions: ProfileReviewItem[]
}

export function canNavigateToSection(target: number, current: number, completedSections: number[]) {
  if (target <= current) return true
  return Array.from({ length: target - current + 1 }, (_, offset) => current + offset)
    .every(section => completedSections.includes(section))
}

export function toggleAnswer(values: string[], value: string) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

export function getProfileReview(profile: HousingProfileData): ProfileReview {
  const blocking = sections.flatMap((_, section) =>
    validateSection(profile, section).map(issue => ({ section, message: issue.message })),
  )
  const suggestions: ProfileReviewItem[] = []
  const { lifestyle, roommatePreferences, priorities, housingBasics } = profile
  const addSuggestion = (section: number, message: string) => suggestions.push({ section, message })

  const dealbreakerConflicts: Array<[string, string, (answer: string) => boolean]> = [
    ['Smoking indoors', 'smoking', answer => answer === 'Smoker'],
    ['Pets in the home', 'pets', answer => answer === 'Have pets'],
    ['Frequent overnight guests', 'guests', answer => answer === 'Frequently'],
    ['Frequent overnight guests', 'overnight', answer => answer === 'Comfortable'],
    ['Late-night noise', 'noise', answer => answer === 'Lively'],
    ['Late-night noise', 'sleep', answer => answer === 'Night owl'],
    ['Unshared cleaning responsibilities', 'cleaning', answer => answer === 'Individual responsibilities'],
    ['Shared groceries', 'groceries', answer => answer === 'Share groceries'],
  ]
  for (const [boundary, key, conflicts] of dealbreakerConflicts) {
    const answer = lifestyle[key as keyof typeof lifestyle]
    if (roommatePreferences.dealbreakers.includes(boundary) && answer && conflicts(answer)) {
      addSuggestion(4, `Your “${boundary}” boundary may conflict with your “${answer}” lifestyle answer. Review both before sharing your profile.`)
    }
  }

  const overlappingPriorities = priorities.ranked.filter(item => priorities.flexible.includes(item))
  if (overlappingPriorities.length) {
    addSuggestion(5, `These appear in both your top priorities and flexible list: ${overlappingPriorities.join(', ')}.`)
  }

  const knownCities = filterCities(housingBasics.state, '')
  if (housingBasics.city.trim() && !knownCities.some(city => city.toLowerCase() === housingBasics.city.trim().toLowerCase())) {
    addSuggestion(0, 'Review your custom city and state combination for spelling and fit.')
  }
  if (housingBasics.lease === 'Semester') {
    addSuggestion(0, 'Your saved “Semester” lease preference does not specify a term. Choose a spring semester or fall semester if you know which fits.')
  }

  return { blocking, suggestions }
}
