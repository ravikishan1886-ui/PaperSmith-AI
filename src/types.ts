export type QuestionType = 'MCQ' | 'VSA' | 'SA' | 'LA' | 'CASE';
export type ViewState = 'config' | 'archive' | 'library' | 'settings' | 'users';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options?: string[];
  subQuestions?: { text: string; marks: number }[];
}

export interface Section {
  title: string;
  description: string;
  questions: Question[];
}

export interface Paper {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  totalMarks: number;
  time: string;
  sections: Section[];
  generatedAt: string;
  authorEmail?: string;
}

export const CHAPTER_1_PAPER: Paper = {
  id: "p1",
  title: "Periodic Assessment - I",
  generatedAt: "2024-05-04T10:00:00Z",
  subject: "Science (Chemistry)",
  chapter: "Chemical Reactions and Equations",
  totalMarks: 40,
  time: "1.5 Hours",
  sections: [
    {
      title: "Section A: Multiple Choice Questions",
      description: "Each question carries 1 mark.",
      questions: [
        {
          id: "q1",
          type: "MCQ",
          text: "What is observed when a magnesium ribbon is burnt in air?",
          marks: 1,
          options: [
            "A dazzling white flame and white powder",
            "A yellow flame and black powder",
            "A blue flame and ash",
            "No visible change"
          ]
        },
        {
          id: "q2",
          type: "MCQ",
          text: "The decomposition of vegetable matter into compost is an example of:",
          marks: 1,
          options: [
            "Endothermic reaction",
            "Exothermic reaction",
            "Displacement reaction",
            "Combination reaction"
          ]
        },
        {
          id: "q3",
          type: "MCQ",
          text: "Which of the following is the chemical formula of Quick Lime?",
          marks: 1,
          options: ["Ca(OH)2", "CaO", "CaCO3", "CaCl2"]
        },
        {
          id: "q4",
          type: "MCQ",
          text: "When hydrogen gas is passed over heated copper oxide, the black coating turns brown due to:",
          marks: 1,
          options: ["Oxidation", "Reduction", "Crystallization", "Evaporation"]
        },
        {
          id: "q5",
          type: "MCQ",
          text: "The reaction Fe + CuSO4 → FeSO4 + Cu is an example of:",
          marks: 1,
          options: ["Combination", "Decomposition", "Single Displacement", "Double Displacement"]
        },
        {
          id: "q6",
          type: "MCQ",
          text: "Fatty foods become rancid due to the process of:",
          marks: 1,
          options: ["Reduction", "Hydrogenation", "Oxidation", "Corrosion"]
        },
        {
          id: "q7",
          type: "MCQ",
          text: "What is the color of the precipitate formed when Barium Chloride reacts with Sodium Sulphate?",
          marks: 1,
          options: ["Yellow", "White", "Blue", "Black"]
        },
        {
          id: "q8",
          type: "MCQ",
          text: "In the electrolysis of water, the gas collected at the cathode is:",
          marks: 1,
          options: ["Oxygen", "Hydrogen", "Nitrogen", "Chlorine"]
        },
        {
          id: "q9",
          type: "MCQ",
          text: "Which equation is correctly balanced?",
          marks: 1,
          options: [
            "Mg + O2 → MgO",
            "2Mg + O2 → 2MgO",
            "Mg + 2O2 → MgO2",
            "3Mg + O2 → Mg3O2"
          ]
        },
        {
          id: "q10",
          type: "MCQ",
          text: "Respiration is considered an exothermic reaction because:",
          marks: 1,
          options: [
            "Energy is absorbed",
            "Oxygen is released",
            "Energy is released during glucose breakdown",
            "Water is released"
          ]
        }
      ]
    },
    {
      title: "Section B: Very Short Answer Questions",
      description: "Each question carries 2 marks.",
      questions: [
        {
          id: "q11",
          type: "VSA",
          text: "Define a balanced chemical equation. Why should chemical equations be balanced?",
          marks: 2
        },
        {
          id: "q12",
          type: "VSA",
          text: "What happens when lead nitrate powder is heated in a boiling tube? Write the observation and the gas evolved.",
          marks: 2
        },
        {
          id: "q13",
          type: "VSA",
          text: "Identify the substance oxidized and the substance reduced in the following reaction: CuO + H2 → Cu + H2O",
          marks: 2
        },
        {
          id: "q14",
          type: "VSA",
          text: "Why is the amount of gas collected in one of the test tubes in electrolysis of water double of the amount collected in the other? Name this gas.",
          marks: 2
        },
        {
          id: "q15",
          type: "VSA",
          text: "What is a precipitation reaction? Give an example from the chapter.",
          marks: 2
        },
        {
          id: "q16",
          type: "VSA",
          text: "Silver Chloride is stored in dark colored bottles. Suggest a reason based on its reaction to light.",
          marks: 2
        }
      ]
    },
    {
      title: "Section C: Short Answer Questions",
      description: "Each question carries 3 marks.",
      questions: [
        {
          id: "q17",
          type: "SA",
          text: "Write balanced chemical equations for the following: \n(a) Hydrogen + Chlorine → Hydrogen Chloride \n(b) Barium Chloride + Aluminium Sulphate → Barium Sulphate + Aluminium Chloride \n(c) Sodium + Water → Sodium Hydroxide + Hydrogen",
          marks: 3
        },
        {
          id: "q18",
          type: "SA",
          text: "Explain the term 'Corrosion' and 'Rancidity'. Suggest one method each to prevent them.",
          marks: 3
        },
        {
          id: "q19",
          type: "SA",
          text: "What is the difference between displacement and double displacement reactions? Write equations for each.",
          marks: 3
        }
      ]
    },
    {
      title: "Section D: Case Study / Activity Based",
      description: "Read carefully and answer. Total 4 marks.",
      questions: [
        {
          id: "q20",
          type: "CASE",
          text: "Activity 1.3: Take a few zinc granules in a conical flask and add dilute sulphuric acid. \n(a) What do you observe around the zinc granules? \n(b) Is there any change in the temperature of the flask? \n(c) Identify the gas evolved and write the balanced chemical equation for the reaction.",
          marks: 4
        }
      ]
    },
    {
      title: "Section E: Long Answer Questions",
      description: "Question carries 5 marks.",
      questions: [
        {
          id: "q21",
          type: "LA",
          text: "(a) What is a decomposition reaction? \n(b) Explain with one example each: Thermal decomposition, Electrolytic decomposition, and Photolytic decomposition. \n(c) Why are decomposition reactions called opposite of combination reactions?",
          marks: 5
        }
      ]
    }
  ]
};
