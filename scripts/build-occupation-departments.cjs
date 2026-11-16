/* Department-map generator for the Occupation Knowledge Hub catalogue.
   Reads the import JSON, validates one department per occupation, and writes
   the compact department block plus the new occupation rows and video-map
   entries. Run with --write-blocks; the operation is idempotent. */

const fs = require('fs');
const path = require('path');

const toolRoot = path.join(
  __dirname,
  '..',
  'BUSINESS',
  'VERTICAL',
  'education-training',
  'vocational-training',
  'OccupationKnowledgeHub'
);
const importPath = path.join(toolRoot, 'docs', 'occupations-import.json');
const cataloguePath = path.join(toolRoot, 'docs', 'occupations.html');

const DEPARTMENTS = {
  'business-management': ['Business administration and management', 'Business and management'],
  'accounting-finance': ['Accounting and finance', 'Business and management'],
  'marketing-sales': ['Marketing and sales', 'Business and management'],
  'human-resources': ['Human resources', 'Business and management'],
  'supply-chain': ['Supply chain and operations', 'Business and management'],
  'office-administration': ['Office administration', 'Business and management'],

  'computer-science': ['Computer science', 'Information technology'],
  'software-engineering': ['Software engineering', 'Information technology'],
  'computer-engineering': ['Computer engineering', 'Information technology'],
  'information-systems': ['Information systems', 'Information technology'],
  'data-ai-cybersecurity': ['Data science, AI and cybersecurity', 'Information technology'],

  'civil-engineering': ['Civil engineering', 'Engineering and applied science'],
  'mechanical-engineering': ['Mechanical engineering', 'Engineering and applied science'],
  'electrical-engineering': ['Electrical engineering', 'Engineering and applied science'],
  'chemical-engineering': ['Chemical engineering', 'Engineering and applied science'],
  'industrial-engineering': ['Industrial and manufacturing engineering', 'Engineering and applied science'],
  'other-engineering': ['Other engineering', 'Engineering and applied science'],
  'mining-petroleum-engineering': ['Mining and petroleum engineering', 'Engineering and applied science'],
  'engineering-technology': ['Engineering technology', 'Engineering and applied science'],
  'architecture-planning': ['Architecture and planning', 'Engineering and applied science'],
  'construction-management': ['Construction management', 'Engineering and applied science'],
  'geomatics': ['Geomatics and surveying', 'Engineering and applied science'],

  'mathematics-statistics': ['Mathematics and statistics', 'Science'],
  'science': ['Physical and life sciences', 'Science'],
  'environmental-science': ['Environmental science', 'Science'],
  'agriculture-food-science': ['Agriculture and food science', 'Science'],

  'health-sciences': ['Health sciences', 'Health'],
  'nursing': ['Nursing', 'Health'],
  'pharmacy-dentistry': ['Pharmacy and dentistry', 'Health'],
  'rehabilitation-diagnostics': ['Rehabilitation and diagnostics', 'Health'],
  'public-health-administration': ['Public health and health administration', 'Health'],
  'occupational-health-safety': ['Occupational health and safety', 'Health'],

  'social-sciences': ['Social sciences', 'Social and community services'],
  'social-work-community': ['Social work and community services', 'Social and community services'],

  'education': ['Education', 'Education and training'],

  'law-public-safety': ['Law and public safety', 'Legal and public safety'],

  'arts-design': ['Arts and design', 'Arts, culture and media'],
  'media-communication': ['Media and communication', 'Arts, culture and media'],

  'trades-construction': ['Trades and construction', 'Trades and construction'],
  'manufacturing-utilities': ['Manufacturing and utilities', 'Trades and construction'],

  'hospitality-tourism': ['Hospitality and tourism', 'Hospitality and tourism'],

  'personal-services': ['Personal services', 'Personal services and wellness'],

  'transportation': ['Transportation', 'Transportation'],

  'recreation-sport': ['Recreation and sport', 'Recreation and sport'],

  'general-no-post-secondary': ['No post-secondary requirement', 'General']
};

const FACULTIES = [
  ['business', 'Business and management'],
  ['it', 'Information technology'],
  ['engineering', 'Engineering and applied science'],
  ['science', 'Science'],
  ['health', 'Health'],
  ['social', 'Social and community services'],
  ['education', 'Education and training'],
  ['law', 'Legal and public safety'],
  ['arts', 'Arts, culture and media'],
  ['trades', 'Trades and construction'],
  ['hospitality', 'Hospitality and tourism'],
  ['personal', 'Personal services and wellness'],
  ['transport', 'Transportation'],
  ['recreation', 'Recreation and sport'],
  ['general', 'General']
];

const facultyByLabel = {};
FACULTIES.forEach(function (faculty) { facultyByLabel[faculty[1]] = faculty[0]; });

const MAP_TEXT = `
management
chief-executive-officer=business-management
general-manager=business-management
operations-manager=business-management
project-manager=business-management
human-resources-manager=human-resources
finance-manager=accounting-finance
marketing-manager=marketing-sales
sales-manager=marketing-sales
purchasing-manager=supply-chain
facilities-manager=business-management
construction-manager=construction-management
health-services-manager=public-health-administration
restaurant-manager=hospitality-tourism
retail-manager=business-management
hotel-manager=hospitality-tourism
engineering-manager=industrial-engineering
it-manager=information-systems
mine-manager=mining-petroleum-engineering

business-finance
accountant=accounting-finance
financial-auditor=accounting-finance
bookkeeper=accounting-finance
payroll-administrator=accounting-finance
financial-analyst=accounting-finance
investment-analyst=accounting-finance
financial-planner=accounting-finance
insurance-underwriter=accounting-finance
insurance-broker=accounting-finance
claims-adjuster=accounting-finance
loan-officer=accounting-finance
mortgage-broker=accounting-finance
tax-preparer=accounting-finance
economist=social-sciences
actuary=mathematics-statistics
management-consultant=business-management
real-estate-agent=business-management
procurement-officer=supply-chain
customs-broker=transportation
property-manager=business-management
accounting-clerk=accounting-finance

office-administration
administrative-assistant=office-administration
executive-assistant=office-administration
receptionist=office-administration
data-entry-clerk=office-administration
records-management-technician=office-administration
office-manager=office-administration
legal-administrative-assistant=law-public-safety
medical-administrative-assistant=public-health-administration
human-resources-assistant=human-resources
event-coordinator=hospitality-tourism

information-technology
software-developer=computer-science
web-developer=software-engineering
mobile-app-developer=software-engineering
game-developer=software-engineering
data-scientist=data-ai-cybersecurity
data-engineer=data-ai-cybersecurity
data-analyst=data-ai-cybersecurity
machine-learning-engineer=data-ai-cybersecurity
ai-specialist=data-ai-cybersecurity
database-administrator=information-systems
systems-administrator=information-systems
network-administrator=information-systems
cloud-architect=information-systems
devops-engineer=software-engineering
cybersecurity-analyst=data-ai-cybersecurity
qa-analyst=software-engineering
technical-support-specialist=information-systems
ux-designer=arts-design
product-manager=business-management
business-analyst=business-management

engineering-science
civil-engineer=civil-engineering
mechanical-engineer=mechanical-engineering
electrical-engineer=electrical-engineering
electronics-engineer=electrical-engineering
chemical-engineer=chemical-engineering
industrial-engineer=industrial-engineering
manufacturing-engineer=industrial-engineering
aerospace-engineer=other-engineering
mining-engineer=mining-petroleum-engineering
petroleum-engineer=mining-petroleum-engineering
environmental-engineer=other-engineering
biomedical-engineer=other-engineering
materials-engineer=other-engineering
structural-engineer=civil-engineering
architect=architecture-planning
urban-planner=architecture-planning
engineering-technologist=engineering-technology
drafting-technologist=engineering-technology
chemist=science
biologist=science
geologist=science
laboratory-technician=science
landscape-architect=architecture-planning
robotics-engineer=computer-engineering
land-surveyor=geomatics
geological-technician=science
hydrogeology-engineer=other-engineering

environmental-science
environmental-scientist=environmental-science
conservation-officer=environmental-science
environmental-impact-analyst=environmental-science
sustainability-coordinator=environmental-science
environmental-health-officer=public-health-administration
wildlife-technician=environmental-science
recycling-coordinator=environmental-science
park-interpreter=environmental-science
oceanographer=science
health-and-safety-consultant=occupational-health-safety
environmental-safety-consultant=environmental-science

health-care
registered-nurse=nursing
licensed-practical-nurse=nursing
nurse-practitioner=nursing
registered-psychiatric-nurse=nursing
health-care-aide=health-sciences
physician-assistant=health-sciences
family-physician=health-sciences
specialist-physician=health-sciences
surgeon=health-sciences
psychiatrist=health-sciences
dentist=pharmacy-dentistry
dental-hygienist=pharmacy-dentistry
dental-assistant=pharmacy-dentistry
optometrist=rehabilitation-diagnostics
pharmacist=pharmacy-dentistry
pharmacy-technician=pharmacy-dentistry
physiotherapist=rehabilitation-diagnostics
occupational-therapist=rehabilitation-diagnostics
respiratory-therapist=rehabilitation-diagnostics
speech-language-pathologist=rehabilitation-diagnostics
audiologist=rehabilitation-diagnostics
dietitian=health-sciences
chiropractor=rehabilitation-diagnostics
massage-therapist=rehabilitation-diagnostics
psychologist=social-sciences
medical-laboratory-technologist=rehabilitation-diagnostics
medical-radiation-technologist=rehabilitation-diagnostics
paramedic=health-sciences
midwife=health-sciences
veterinarian=health-sciences
pharmacy-assistant=pharmacy-dentistry
radiation-therapist=rehabilitation-diagnostics
optician=rehabilitation-diagnostics
medical-sonographer=rehabilitation-diagnostics
acupuncturist=rehabilitation-diagnostics
registered-animal-health-technician=health-sciences

social-community
social-worker=social-work-community
child-protection-worker=social-work-community
child-youth-care-worker=social-work-community
addictions-counsellor=social-sciences
family-therapist=social-sciences
community-service-worker=social-work-community
settlement-worker=social-work-community
disability-support-worker=social-work-community
employment-counsellor=social-sciences
volunteer-coordinator=social-work-community
funeral-director=personal-services
social-development-manager=social-work-community
indigenous-advisor=social-work-community

education-training
elementary-school-teacher=education
secondary-school-teacher=education
early-childhood-educator=education
educational-assistant=education
special-education-teacher=education
school-counsellor=social-sciences
college-instructor=education
university-professor=education
school-principal=education
esl-teacher=education
curriculum-consultant=education
instructional-designer=education
librarian=education
career-counsellor=social-sciences
university-dean=education

legal-public-safety
lawyer=law-public-safety
paralegal=law-public-safety
notary-public=law-public-safety
police-officer=law-public-safety
correctional-officer=law-public-safety
probation-officer=law-public-safety
firefighter=law-public-safety
fire-inspector=law-public-safety
border-services-officer=law-public-safety
security-guard=law-public-safety
emergency-dispatcher=law-public-safety
policy-analyst=social-sciences
building-inspector=trades-construction

arts-culture-media
graphic-designer=arts-design
interior-designer=arts-design
industrial-designer=arts-design
fashion-designer=arts-design
animator=arts-design
photographer=media-communication
videographer=media-communication
video-editor=media-communication
film-director=media-communication
actor=arts-design
musician=arts-design
dancer=arts-design
visual-artist=arts-design
copywriter=media-communication
journalist=media-communication
translator=media-communication
social-media-manager=media-communication
public-relations-specialist=media-communication
audiovisual-technician=media-communication
author=media-communication
managing-editor=media-communication
producer=media-communication

sports-recreation
professional-athlete=recreation-sport
coach=recreation-sport
fitness-instructor=recreation-sport
personal-trainer=recreation-sport
athletic-therapist=rehabilitation-diagnostics
sports-referee=recreation-sport
recreation-programme-coordinator=recreation-sport
lifeguard=recreation-sport
outdoor-guide=recreation-sport

sales-retail
retail-sales-associate=marketing-sales
store-supervisor=marketing-sales
retail-buyer=marketing-sales
merchandiser=marketing-sales
wholesale-sales-representative=marketing-sales
account-manager=marketing-sales
business-development-manager=marketing-sales
car-salesperson=marketing-sales
telemarketer=marketing-sales
cashier=general-no-post-secondary
ecommerce-specialist=marketing-sales
sales-coordinator=marketing-sales

hospitality-tourism
hotel-front-desk-agent=hospitality-tourism
concierge=hospitality-tourism
housekeeping-supervisor=hospitality-tourism
travel-agent=hospitality-tourism
tour-guide=hospitality-tourism
flight-attendant=transportation
event-planner=hospitality-tourism
casino-dealer=hospitality-tourism
tourism-marketing-officer=hospitality-tourism

food-service
chef=hospitality-tourism
cook=hospitality-tourism
baker=hospitality-tourism
butcher=hospitality-tourism
food-service-supervisor=hospitality-tourism
server=hospitality-tourism
bartender=hospitality-tourism
barista=hospitality-tourism
kitchen-helper=hospitality-tourism
brew-master=hospitality-tourism

personal-service
hairstylist=personal-services
barber=personal-services
esthetician=personal-services
nail-technician=personal-services
nanny=personal-services
pet-groomer=personal-services
janitor=general-no-post-secondary
cleaning-supervisor=general-no-post-secondary
customer-service-representative=office-administration
call-centre-agent=office-administration

trades-construction
carpenter=trades-construction
electrician=trades-construction
plumber=trades-construction
pipefitter=trades-construction
welder=trades-construction
sheet-metal-worker=trades-construction
ironworker=trades-construction
millwright=trades-construction
machinist=trades-construction
cabinetmaker=trades-construction
bricklayer=trades-construction
concrete-finisher=trades-construction
roofer=trades-construction
glazier=trades-construction
insulator=trades-construction
painter-and-decorator=trades-construction
drywall-installer=trades-construction
tile-setter=trades-construction
crane-operator=trades-construction
heavy-equipment-operator=trades-construction
construction-labourer=trades-construction
construction-estimator=construction-management
site-supervisor=construction-management
solar-installer=trades-construction
elevator-mechanic=trades-construction
refrigeration-mechanic=trades-construction
automotive-service-technician=trades-construction
gas-fitter=trades-construction
heavy-duty-equipment-mechanic=trades-construction
instrument-mechanic=trades-construction

transport-logistics
truck-driver=transportation
delivery-driver=transportation
bus-driver=transportation
taxi-driver=transportation
train-conductor=transportation
locomotive-engineer=transportation
airline-pilot=transportation
flight-instructor=transportation
air-traffic-controller=transportation
aircraft-maintenance-engineer=transportation
ship-captain=transportation
warehouse-worker=transportation
forklift-operator=transportation
logistics-coordinator=transportation
dispatcher=transportation
postal-worker=transportation
longshore-worker=transportation
harbour-master=transportation
deck-hand=transportation

agriculture-natural-resources
crop-farmer=agriculture-food-science
livestock-farmer=agriculture-food-science
dairy-farmer=agriculture-food-science
farm-supervisor=agriculture-food-science
agronomist=agriculture-food-science
animal-nutritionist=agriculture-food-science
logger=agriculture-food-science
forestry-technologist=agriculture-food-science
fisher=agriculture-food-science
underground-miner=mining-petroleum-engineering
blaster=mining-petroleum-engineering
driller=mining-petroleum-engineering
oil-and-gas-drilling-operator=mining-petroleum-engineering
beekeeper=agriculture-food-science
grounds-maintenance-worker=agriculture-food-science
nursery-and-greenhouse-worker=agriculture-food-science
landscape-horticulturalist=agriculture-food-science
silviculturist=agriculture-food-science
well-site-supervisor=mining-petroleum-engineering

manufacturing-utilities
assembly-worker=manufacturing-utilities
machine-operator=manufacturing-utilities
cnc-machinist=manufacturing-utilities
quality-control-technician=manufacturing-utilities
production-supervisor=manufacturing-utilities
power-engineer=manufacturing-utilities
water-treatment-plant-operator=manufacturing-utilities
wastewater-treatment-operator=manufacturing-utilities
chemical-plant-operator=manufacturing-utilities
food-processing-worker=manufacturing-utilities
sawmill-machine-operator=manufacturing-utilities
printing-press-operator=manufacturing-utilities
material-handler=manufacturing-utilities
boiler-operator=manufacturing-utilities
boat-builder=manufacturing-utilities
`;

const NEW_OCCUPATIONS = `
powerline-technician=trades-construction
arborist=agriculture-food-science
wildland-firefighter=law-public-safety
public-health-inspector=public-health-administration
statistician=mathematics-statistics
anthropologist=social-sciences
curator=arts-design
archivist=arts-design
forester=agriculture-food-science
court-reporter=law-public-safety
bylaw-enforcement-officer=law-public-safety
marriage-and-family-counsellor=social-sciences
operations-research-analyst=mathematics-statistics
geomatics-technologist=geomatics
hazardous-waste-management-technologist=environmental-science
hydrometric-technician=environmental-science
land-titles-analyst=office-administration
broadcast-maintenance-technologist=media-communication
optical-laboratory-technician=rehabilitation-diagnostics
audiometric-technician=rehabilitation-diagnostics
prosthetic-and-orthotic-technician=rehabilitation-diagnostics
podiatric-physician=health-sciences
turfgrass-management-specialist=agriculture-food-science
vending-machine-technician=trades-construction
banquet-manager=hospitality-tourism
casting-director=media-communication
costume-designer=arts-design
cinematographer=media-communication
art-instructor=education
professional-investigator=law-public-safety
ecologist=environmental-science
entomologist=science
advertising-account-executive=marketing-sales
auto-detailer=trades-construction
floral-designer=personal-services
makeup-artist=personal-services
occupational-hygienist=occupational-health-safety
ergonomist=occupational-health-safety
cardiology-technologist=rehabilitation-diagnostics
database-analyst=information-systems
mental-health-aide=health-sciences
unit-clerk=public-health-administration
health-information-manager=public-health-administration
dental-laboratory-technician=pharmacy-dentistry
wind-turbine-technician=trades-construction
`;

const NEW_OBJECTS = [
  { name: 'Powerline technician', slug: 'powerline-technician', industry: 'trades-construction', education: 'apprenticeship', blurb: 'Builds and repairs overhead and underground power lines.', department: 'trades-construction', video: ['Nvcd60j9Sfg', 'Occupational Video - Powerline Technician'] },
  { name: 'Arborist', slug: 'arborist', industry: 'agriculture-natural-resources', education: 'apprenticeship', blurb: 'Prunes, plants and cares for trees and shrubs.', department: 'agriculture-food-science', video: ['_iAR0OIoEaQ', 'Occupational Video - Arborist'] },
  { name: 'Wildland firefighter', slug: 'wildland-firefighter', industry: 'legal-public-safety', education: 'college', blurb: 'Controls forest and grassland fires.', department: 'law-public-safety', video: ['VF6n2usxw_Y', 'Occupational Video - Wildland Firefighter'] },
  { name: 'Public health inspector', slug: 'public-health-inspector', industry: 'health-care', education: 'university-bachelor', blurb: 'Inspects food, water and facilities for health risks.', department: 'public-health-administration', video: ['1kZdLjKVHm4', 'Occupational Video - Public Health Inspector'] },
  { name: 'Statistician', slug: 'statistician', industry: 'business-finance', education: 'university-graduate', blurb: 'Designs studies and analyses numerical data.', department: 'mathematics-statistics', video: ['a4n5AwEmcq4', 'Occupational Video - Statistician'] },
  { name: 'Anthropologist', slug: 'anthropologist', industry: 'social-community', education: 'university-graduate', blurb: 'Studies human cultures and societies.', department: 'social-sciences', video: ['nTEgcSjTCRk', 'Occupational Video - Anthropologist'] },
  { name: 'Curator', slug: 'curator', industry: 'arts-culture-media', education: 'university-graduate', blurb: 'Builds and interprets museum collections.', department: 'arts-design', video: ['RVlHmcwffUc', 'Occupational Video - Curator'] },
  { name: 'Archivist', slug: 'archivist', industry: 'arts-culture-media', education: 'university-graduate', blurb: 'Preserves and describes historical records.', department: 'arts-design', video: ['lavWz_oCLyw', 'Occupational Video - Archivist'] },
  { name: 'Forester', slug: 'forester', industry: 'agriculture-natural-resources', education: 'university-bachelor', blurb: 'Plans the sustainable management of forests.', department: 'agriculture-food-science', video: ['tnlgToLAS2c', 'Occupational Video - Forester'] },
  { name: 'Court reporter', slug: 'court-reporter', industry: 'legal-public-safety', education: 'college', blurb: 'Records legal proceedings word for word.', department: 'law-public-safety', video: ['A643syUNdLw', 'Occupational Video - Captioner and Court Reporter'] },
  { name: 'Bylaw enforcement officer', slug: 'bylaw-enforcement-officer', industry: 'legal-public-safety', education: 'college', blurb: 'Enforces municipal bylaws and regulations.', department: 'law-public-safety', video: ['TuHZHNb3lSA', 'Occupational Video - Bylaw Enforcement Officer'] },
  { name: 'Marriage and family counsellor', slug: 'marriage-and-family-counsellor', industry: 'social-community', education: 'university-graduate', blurb: 'Helps couples and families resolve problems.', department: 'social-sciences', video: ['1VrDqC9Dl-g', 'Occupational Video - Marriage and Family Counsellor'] },
  { name: 'Operations research analyst', slug: 'operations-research-analyst', industry: 'business-finance', education: 'university-bachelor', blurb: 'Uses models to improve business decisions.', department: 'mathematics-statistics', video: ['9z6jFPxcwz8', 'Occupational Video - Operations Research Analyst'] },
  { name: 'Geomatics technologist', slug: 'geomatics-technologist', industry: 'engineering-science', education: 'college', blurb: 'Measures and maps land and spatial data.', department: 'geomatics', video: ['MT0RtQObVnA', 'Occupational Profile - Geomatics Technologist'] },
  { name: 'Hazardous waste management technologist', slug: 'hazardous-waste-management-technologist', industry: 'environmental-science', education: 'college', blurb: 'Handles and disposes of hazardous materials safely.', department: 'environmental-science', video: ['0TzEP_fNN5Q', 'Occupational Video - Hazardous Waste Management Technologist'] },
  { name: 'Hydrometric technician', slug: 'hydrometric-technician', industry: 'environmental-science', education: 'college', blurb: 'Measures water levels and flows.', department: 'environmental-science', video: ['282bXT5LJbE', 'Occupational Video - Hydrometric Technician / Technologist'] },
  { name: 'Land titles analyst', slug: 'land-titles-analyst', industry: 'office-administration', education: 'college', blurb: 'Reviews land ownership records and transfers.', department: 'office-administration', video: ['XdcMpCeBiYw', 'Occupational Video - Land Titles Analyst'] },
  { name: 'Broadcast maintenance technologist', slug: 'broadcast-maintenance-technologist', industry: 'arts-culture-media', education: 'college', blurb: 'Maintains broadcasting and audio-visual equipment.', department: 'media-communication', video: ['50mMksYoo-w', 'Occupational Video - Broadcast Maintenance Technologist'] },
  { name: 'Optical laboratory technician', slug: 'optical-laboratory-technician', industry: 'health-care', education: 'college', blurb: 'Grinds and fits lenses to prescriptions.', department: 'rehabilitation-diagnostics', video: ['Fmrkde5a63M', 'Occupational Video - Optical Laboratory Technician'] },
  { name: 'Audiometric technician', slug: 'audiometric-technician', industry: 'health-care', education: 'college', blurb: 'Tests hearing and supports audiologists.', department: 'rehabilitation-diagnostics', video: ['cwi0v7UigQA', 'Occupational Video - Audiometric Technician'] },
  { name: 'Prosthetic and orthotic technician', slug: 'prosthetic-and-orthotic-technician', industry: 'health-care', education: 'college', blurb: 'Builds and fits artificial limbs and braces.', department: 'rehabilitation-diagnostics', video: ['D7FLXYNBSLU', 'Occupational Video - Prosthetic and Orthotic Technician'] },
  { name: 'Podiatric physician', slug: 'podiatric-physician', industry: 'health-care', education: 'university-graduate', blurb: 'Diagnoses and treats foot and ankle conditions.', department: 'health-sciences', video: ['YDli2RLWejA', 'Occupational Video - Podiatric Physician'] },
  { name: 'Turfgrass management specialist', slug: 'turfgrass-management-specialist', industry: 'agriculture-natural-resources', education: 'college', blurb: 'Manages sports fields, lawns and turf.', department: 'agriculture-food-science', video: ['_fAX1m8O5o0', 'Occupational Video - Turfgrass Management Specialist'] },
  { name: 'Vending machine technician', slug: 'vending-machine-technician', industry: 'trades-construction', education: 'college', blurb: 'Installs and repairs vending and coin equipment.', department: 'trades-construction', video: ['GES7sififhc', 'Occupational Video - Vending Machine Technician'] },
  { name: 'Banquet manager', slug: 'banquet-manager', industry: 'hospitality-tourism', education: 'college', blurb: 'Runs banquets, conferences and large events.', department: 'hospitality-tourism', video: ['-ln9RdI0s2s', 'Occupational Video - Banquet Manager'] },
  { name: 'Casting director', slug: 'casting-director', industry: 'arts-culture-media', education: 'college', blurb: 'Selects actors for film, television and theatre.', department: 'media-communication', video: ['36CjwexRx3k', 'Occupational Video - Casting Director'] },
  { name: 'Costume designer', slug: 'costume-designer', industry: 'arts-culture-media', education: 'college', blurb: 'Designs and builds costumes for productions.', department: 'arts-design', video: ['GsGakw1Zsik', 'Occupational Video - Costume Designer'] },
  { name: 'Cinematographer', slug: 'cinematographer', industry: 'arts-culture-media', education: 'college', blurb: 'Plans and captures the visual images of a film.', department: 'media-communication', video: ['ht4ELIGymBo', 'Occupational Video - Cinematographer'] },
  { name: 'Art instructor', slug: 'art-instructor', industry: 'education-training', education: 'college', blurb: 'Teaches drawing, painting and studio art.', department: 'education', video: ['Dx5AuPkPpbQ', 'Occupational Video - Art Instructor'] },
  { name: 'Professional investigator', slug: 'professional-investigator', industry: 'legal-public-safety', education: 'college', blurb: 'Investigates fraud, insurance and legal cases.', department: 'law-public-safety', video: ['oC5CSb_HdtU', 'Occupational Video - Professional Investigator'] },
  { name: 'Ecologist', slug: 'ecologist', industry: 'environmental-science', education: 'university-graduate', blurb: 'Studies ecosystems and advises on conservation.', department: 'environmental-science', video: ['UKOIK3j4SNI', 'Occupational Video - Ecologist'] },
  { name: 'Entomologist', slug: 'entomologist', industry: 'environmental-science', education: 'university-graduate', blurb: 'Studies insects and their impact on crops and health.', department: 'science', video: ['bQ0yAZQF0mE', 'Occupational Video - Entomologist'] },
  { name: 'Advertising account executive', slug: 'advertising-account-executive', industry: 'sales-retail', education: 'college', blurb: 'Manages advertising accounts and client campaigns.', department: 'marketing-sales', video: ['GBeo7ErSaoE', 'Occupational Video - Advertising Account Executive'] },
  { name: 'Auto detailer', slug: 'auto-detailer', industry: 'trades-construction', education: 'high-school', blurb: 'Cleans and restores vehicle interiors and exteriors.', department: 'trades-construction', video: ['5SCrDOQAN80', 'Occupational Video - Auto Detailer'] },
  { name: 'Floral designer', slug: 'floral-designer', industry: 'sales-retail', education: 'college', blurb: 'Designs and sells floral arrangements.', department: 'personal-services', video: ['KgyukOAtgqU', 'Occupational Video - Floral Designer'] },
  { name: 'Makeup artist', slug: 'makeup-artist', industry: 'personal-service', education: 'college', blurb: 'Applies makeup for film, theatre and events.', department: 'personal-services', video: ['quZd_9FCySg', 'Occupational Video - Makeup Artist'] },
  { name: 'Occupational hygienist', slug: 'occupational-hygienist', industry: 'environmental-science', education: 'university-bachelor', blurb: 'Assesses workplace exposure to health hazards.', department: 'occupational-health-safety', video: ['lEb4UYnQ8SI', 'Occupational Video - Occupational Hygienist'] },
  { name: 'Ergonomist', slug: 'ergonomist', industry: 'health-care', education: 'university-graduate', blurb: 'Designs workstations and tasks to fit people.', department: 'occupational-health-safety', video: ['D6RZkQQ3WwQ', 'Occupational Video - Ergonomist'] },
  { name: 'Cardiology technologist', slug: 'cardiology-technologist', industry: 'health-care', education: 'college', blurb: 'Runs heart tests and monitors cardiac patients.', department: 'rehabilitation-diagnostics', video: ['-gchSBa0C-k', 'Occupational Video - Cardiology Technologist'] },
  { name: 'Database analyst', slug: 'database-analyst', industry: 'information-technology', education: 'college', blurb: 'Designs and queries databases for business data.', department: 'information-systems', video: ['TAy1JVOQeHg', 'Occupational Video - Database Analyst'] },
  { name: 'Mental health aide', slug: 'mental-health-aide', industry: 'health-care', education: 'college', blurb: 'Supports people living with mental illness.', department: 'health-sciences', video: ['7pIFNd5c0ws', 'Occupational Video - Mental Health Aide'] },
  { name: 'Unit clerk', slug: 'unit-clerk', industry: 'office-administration', education: 'college', blurb: 'Coordinates patient records and unit communications.', department: 'public-health-administration', video: ['y8Jybkpy6Qc', 'Occupational Video - Unit Clerk'] },
  { name: 'Health information manager', slug: 'health-information-manager', industry: 'health-care', education: 'university-bachelor', blurb: 'Manages patient records and health data systems.', department: 'public-health-administration', video: null },
  { name: 'Dental laboratory technician', slug: 'dental-laboratory-technician', industry: 'health-care', education: 'college', blurb: 'Makes crowns, bridges and dental prosthetics.', department: 'pharmacy-dentistry', video: null },
  { name: 'Wind turbine technician', slug: 'wind-turbine-technician', industry: 'trades-construction', education: 'college', blurb: 'Installs and maintains wind turbines.', department: 'trades-construction', video: null }
];

function parseMap(text) {
  const map = {};
  const duplicates = [];
  text.split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line.indexOf('=') === -1) return;
    const parts = line.split('=');
    const slug = parts[0].trim();
    const department = parts[1].trim();
    if (map[slug] && map[slug] !== department) duplicates.push(slug);
    map[slug] = department;
  });
  return { map: map, duplicates: duplicates };
}

const existing = parseMap(MAP_TEXT);
const added = parseMap(NEW_OCCUPATIONS);
const map = Object.assign({}, existing.map, added.map);

const json = JSON.parse(fs.readFileSync(importPath, 'utf8'));
const knownSlugs = new Set(json.objects.map(function (object) { return object.slug; }));
const newSlugs = new Set(added.map ? Object.keys(added.map) : []);
const missing = json.objects.filter(function (object) { return !map[object.slug]; }).map(function (object) { return object.slug; });
const unknown = Object.keys(map).filter(function (slug) { return !knownSlugs.has(slug) && !newSlugs.has(slug); });
const badDepartments = Object.keys(map).filter(function (slug) { return !DEPARTMENTS[map[slug]]; });

const byDepartment = {};
Object.keys(map).forEach(function (slug) {
  const department = map[slug];
  byDepartment[department] = (byDepartment[department] || 0) + 1;
});

console.log('existing mapped: ' + Object.keys(existing.map).length);
console.log('new mapped: ' + Object.keys(added.map).length);
console.log('total mapped: ' + Object.keys(map).length);
console.log('missing existing: ' + missing.length + (missing.length ? ' -> ' + missing.join(', ') : ''));
console.log('unknown slugs: ' + unknown.length + (unknown.length ? ' -> ' + unknown.join(', ') : ''));
console.log('bad departments: ' + badDepartments.length + (badDepartments.length ? ' -> ' + badDepartments.join(', ') : ''));
console.log('duplicate assignments: ' + existing.duplicates.length + (existing.duplicates.length ? ' -> ' + existing.duplicates.join(', ') : ''));
console.log('departments used: ' + Object.keys(byDepartment).length);
Object.keys(byDepartment).sort().forEach(function (slug) {
  console.log('  ' + slug + ': ' + byDepartment[slug]);
});

if (process.argv.indexOf('--write-blocks') !== -1) {
  const departmentSlugs = Object.keys(DEPARTMENTS);
  const departments = departmentSlugs.map(function (slug) {
    const info = DEPARTMENTS[slug];
    return { slug: slug, label: info[0], faculty: facultyByLabel[info[1]], facultyLabel: info[1] };
  });
  const departmentIndex = {};
  departments.forEach(function (department, index) { departmentIndex[department.slug] = index; });

  const byObjectIndex = [];
  const existingSlugs = new Set(json.objects.map(function (object) { return object.slug; }));
  json.objects.forEach(function (object) {
    const slug = map[object.slug];
    if (!slug) throw new Error('Missing department for ' + object.slug);
    byObjectIndex.push(departmentIndex[slug]);
  });
  NEW_OBJECTS.forEach(function (object) {
    if (existingSlugs.has(object.slug)) return;
    if (departmentIndex[object.department] === undefined) throw new Error('Missing department for new object ' + object.slug);
    byObjectIndex.push(departmentIndex[object.department]);
  });

  const block = {
    note: 'Catalogue-only graduation departments. One department per occupation, used by the catalogue filter. The importer must ignore this key.',
    faculties: FACULTIES.map(function (faculty) { return { id: faculty[0], label: faculty[1] }; }),
    list: departments,
    byObjectIndex: byObjectIndex
  };
  const blockText = '{\n' +
    '  "note": ' + JSON.stringify(block.note) + ',\n' +
    '  "faculties": [\n' + block.faculties.map(function (faculty) { return '    ' + JSON.stringify(faculty); }).join(',\n') + '\n  ],\n' +
    '  "list": [\n' + block.list.map(function (department) { return '    ' + JSON.stringify(department); }).join(',\n') + '\n  ],\n' +
    '  "byObjectIndex": [' + block.byObjectIndex.join(',') + ']\n' +
    '}';
  fs.writeFileSync(path.join(process.env.TEMP, 'okh-departments-index.json'), blockText, 'utf8');

  const newObjectLines = NEW_OBJECTS.map(function (object) {
    const output = {
      name: object.name,
      slug: object.slug,
      industry: object.industry,
      education: object.education,
      blurb: object.blurb
    };
    if (object.video) {
      output.media = {
        videos: [{
          title: object.video[1],
          url: 'https://www.youtube.com/watch?v=' + object.video[0],
          source: 'ALIS (Government of Alberta)',
          channel: 'alisWebsite'
        }]
      };
    }
    return JSON.stringify(output);
  });
  const newObjectText = newObjectLines.map(function (line, index) {
    return '    ' + line + (index < newObjectLines.length - 1 ? ',' : '');
  }).join('\n');
  fs.writeFileSync(path.join(process.env.TEMP, 'okh-new-object-lines.txt'), newObjectText, 'utf8');

  const newDataRows = NEW_OBJECTS.map(function (object) {
    return [object.name, object.industry, object.education, object.blurb];
  });
  const newDataText = newDataRows.map(function (row, index) {
    return '    ' + JSON.stringify(row) + (index < newDataRows.length - 1 ? ',' : '');
  }).join('\n');
  fs.writeFileSync(path.join(process.env.TEMP, 'okh-new-data-rows.txt'), newDataText, 'utf8');

  const videoObjects = NEW_OBJECTS.filter(function (object) { return object.video; });
  const newMapText = videoObjects.map(function (object, index) {
    return '    ' + JSON.stringify(object.name) + ': [[' + JSON.stringify(object.video[0]) + ', ' + JSON.stringify(object.video[1]) + ', "ALIS"]]' +
      (index < videoObjects.length - 1 ? ',' : '');
  }).join('\n');
  fs.writeFileSync(path.join(process.env.TEMP, 'okh-new-map-lines.txt'), newMapText, 'utf8');

  console.log('wrote departments index (' + byObjectIndex.length + ' occupations), ' + newObjectLines.length + ' object lines and ' + newDataRows.length + ' data rows');
}
