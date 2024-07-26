export const workContent = {
    title: "my work",
    introduction: "On a mission to build products developers love, and along the way, teach the next generation of developers. Here's a summary of my work so far.",
    experiences: [
      {
        company: "Intuit",
        position: "Fullstack engineer",
        description: "Description of your role and achievements",
        achievements: [
          "Achievement 1",
          "Achievement 2",
          "Achievement 3"
        ]
      },
      // Add more work experiences as needed
      // {
      //   company: "Previous Company",
      //   position: "Previous Position",
      //   description: "Description of your previous role",
      //   achievements: [
      //     "Previous Achievement 1",
      //     "Previous Achievement 2"
      //   ]
      // }
    ]
  };

  type CompanyIcons = {
    [key: string]: string; // This allows any string key with a string value
  };
  
  
  export const companyIcons: CompanyIcons = {
    "Intuit": "/content/images/intuit.png",
    // "Previous Company": "/path/to/previous-company-icon.svg",
    // Add more company icons as needed
  };
