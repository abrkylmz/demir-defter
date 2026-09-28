/** [kas grubu, [[hareket adı, barbell mi (1/0)], ...]] */
export const LIB: [string, [string, 0 | 1][]][] = [
  [
    'Göğüs',
    [
      ['Bench Press', 1],
      ['Eğimli Bench Press', 1],
      ['Dambıl Bench Press', 0],
      ['Eğimli Dambıl Press', 0],
      ['Dambıl Fly', 0],
      ['Cable Crossover', 0],
      ['Chest Press Makinesi', 0],
      ['Pec Deck', 0],
      ['Dips', 0],
      ['Şınav', 0],
    ],
  ],
  [
    'Sırt',
    [
      ['Deadlift', 1],
      ['Barbell Row', 1],
      ['Barfiks', 0],
      ['Lat Pulldown', 0],
      ['Dambıl Row', 0],
      ['Seated Cable Row', 0],
      ['T-Bar Row', 0],
      ['Face Pull', 0],
      ['Back Extension', 0],
    ],
  ],
  [
    'Bacak',
    [
      ['Squat', 1],
      ['Front Squat', 1],
      ['Romanian Deadlift', 1],
      ['Hip Thrust', 1],
      ['Leg Press', 0],
      ['Hack Squat', 0],
      ['Bulgarian Split Squat', 0],
      ['Lunge', 0],
      ['Leg Extension', 0],
      ['Leg Curl', 0],
      ['Calf Raise', 0],
    ],
  ],
  [
    'Omuz',
    [
      ['Overhead Press', 1],
      ['Dambıl Omuz Press', 0],
      ['Arnold Press', 0],
      ['Lateral Raise', 0],
      ['Rear Delt Fly', 0],
      ['Upright Row', 0],
      ['Shrug', 0],
    ],
  ],
  [
    'Kol',
    [
      ['Barbell Curl', 1],
      ['Dambıl Curl', 0],
      ['Hammer Curl', 0],
      ['Preacher Curl', 0],
      ['Cable Curl', 0],
      ['Triceps Pushdown', 0],
      ['Skull Crusher', 0],
      ['Overhead Triceps Extension', 0],
      ['Close-Grip Bench Press', 1],
    ],
  ],
  [
    'Karın',
    [
      ['Mekik', 0],
      ['Cable Crunch', 0],
      ['Hanging Leg Raise', 0],
      ['Ab Wheel', 0],
      ['Russian Twist', 0],
    ],
  ],
];

export const OTHER_GROUP = 'Diğer';
export const GROUPS = LIB.map(g => g[0]).concat([OTHER_GROUP]);
