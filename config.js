/* Bee's Service and AC: live offers, the membership and the no-license cap. ONE place to change them.
   The club name is not decided yet: rename it here only (club). Used by the HVAC forms, texts and PDFs. */
window.BEES = {
  club: 'Comfort Club',
  monthly: 15, yearly: 149, extraMonthly: 8, extraYearly: 79, memberOff: 15,
  safety: 79, safetyName: 'Furnace Safety Check', diag: 89,
  cap: 1000,
  disclosure: 'Not a licensed contractor. Service and repair jobs under $1,000.'
};
window.BEES.plans = ['Monthly $' + window.BEES.monthly, 'Yearly $' + window.BEES.yearly];
var BEES = window.BEES;
/* the HVAC pack (packs.js) loads first: give its member plan field these prices */
try { const hp = window.MT && MT.allPacks && MT.allPacks().find(p => p.id === 'hvac'); const pf = hp && hp.fields.find(f => f.id === 'hv_plan'); if (pf) pf.options = BEES.plans.slice(); } catch (e) {}
/* Knockout Forms app config.
   Business branding and the list of forms live here, so a new form is one more entry
   in FORMS and a new business is a new BUSINESS block. Later this file becomes one
   "pack" inside the shared CRM. pack / packs: which trades can use the form. A form whose packs are all off still shows in
   Forms settings (switched off) so a shop can turn it on; it stays hidden from Start until then.
   pack: 'all' (Estimate, Invoice) is on for every trade. Sign-off and Warranty include solar. The business look here is the Plumbing
   pack default; the business config (mt_biz) overrides it. */
window.APP_CONFIG = {
  business: {
    id: 'knockout',
    name: 'Knockout Plumbing',
    tagline: "We're in your corner.",
    phone: '',            // set in the app: Settings > Business look
    email: '',            // same
    logo: 'logo.png',     // default logo; a shop can upload its own in Settings
    colors: { primary: '#B0382E', accent: '#1F2D45', bg: '#F3EBE0' },
    thanks: "Thanks for choosing Knockout Plumbing. We're in your corner. Keep a copy for your records."
  },
  // Donate spot in Settings. Left blank on purpose for now: the button shows as "coming soon".
  donateUrl: '',

  forms: [
    {
      id: 'wh-agreement', pack: 'plumbing', icon: 'heater',
      title: 'Water Heater Service Agreement', short: 'Water heater plan',
      blurb: 'Yearly water heater plan. Basic or Plus.',
      sections: [
        { title: 'Your water heater', fields: [
          { id: 'wh_type', label: 'Type', type: 'multi', options: ['Tank', 'Tankless'] },
          { id: 'wh_count', label: 'Number of water heaters', type: 'number', half: true }
        ]},
        { title: 'Pick your plan', prices: true, fields: [
          { id: 'plan', type: 'pricegrid', label: 'Plan',
            cols: [{ id: 'tankless', label: 'Tankless' }, { id: 'tank', label: 'Tank' }], unit: '/ year',
            rows: [{ id: 'basic', label: 'BASIC', sub: '1 visit a year' }, { id: 'plus', label: 'PLUS', sub: '2 visits a year' }],
            // only show the columns for the type(s) picked in wh_type (all of them until one is picked)
            showColsFrom: 'wh_type',
            note: 'Prices are per water heater.' }
        ]},
        { title: 'In your corner every visit', fields: [
          { id: 'included', type: 'static', items: [
            'Flush or descale the water heater', 'Test the relief valve and water pressure', 'Check for leaks',
            'Check venting and gas safety', 'Check earthquake straps', 'Check the anode rod (tank units)',
            'Written report after each visit'] }
        ]},
        { title: 'Member perks', prices: true, fields: [
          { id: 'perk_priority', type: 'static', items: ['Priority scheduling'] },
          { id: 'repair_discount', label: '% off repairs', type: 'percent', half: true },
          { id: 'perk_trip', type: 'static', items: ['No trip fee on repair calls'] }
        ]},
        { title: 'How you pay', fields: [
          { id: 'pay_method', label: 'Payment', type: 'choice', options: ['Cash', 'Check', 'Card'] },
          { id: 'pay_when', label: 'When', type: 'choice', options: ['Pay each visit', 'Pay for the year up front'] }
        ]}
      ]
    },

    {
      id: 'estimate', pack: 'all', icon: 'clipboard',
      title: 'Estimate', short: 'Estimate',
      blurb: 'Give them options. They sign to OK one.',
      sections: [
        { title: "What's going on", fields: [
          { id: 'problem', label: 'What we found', type: 'textarea' }
        ]},
        { title: 'Your options', prices: true, fields: [
          { id: 'options', type: 'options', label: 'Options', names: ['Good', 'Better', 'Best'] },
          { id: 'valid_days', label: 'Price good for (days)', type: 'number', half: true }
        ]},
        { title: 'Your pick', fields: [
          { id: 'picked', label: 'Option picked', type: 'choice', options: ['Good', 'Better', 'Best', 'Not yet'] },
          { id: 'deposit', label: 'Deposit today', type: 'money', half: true }
        ]}
      ]
    },

    {
      id: 'invoice', pack: 'all', icon: 'receipt',
      title: 'Invoice', short: 'Invoice',
      blurb: 'What we did and what it costs.',
      sections: [
        { title: 'The job', fields: [
          { id: 'invoice_no', label: 'Invoice #', type: 'text', half: true, auto: 'invoice' },
          { id: 'work_done', label: 'Work done', type: 'textarea' }
        ]},
        { title: 'Charges', prices: true, fields: [
          { id: 'lines', type: 'lineitems', label: 'Charges' },
          { id: 'tax', label: 'Tax %', type: 'percent', half: true }
        ]},
        { title: 'Payment', fields: [
          { id: 'pay_status', label: 'Status', type: 'choice', options: ['Paid today', 'Due'] },
          { id: 'pay_method', label: 'Paid by', type: 'choice', options: ['Cash', 'Check', 'Card', 'Other'] },
          { id: 'due_date', label: 'Due by', type: 'date', half: true }
        ]}
      ]
    },

    {
      /* shared by Plumbing and HVAC (packs). byPack swaps the checklist for that trade. */
      id: 'signoff', pack: 'all', icon: 'check',
      title: 'Job Completion Sign-Off', short: 'Job sign-off',
      blurb: 'Customer signs that the job is done right.',
      sections: [
        { title: 'The job', fields: [
          { id: 'work_done', label: 'Work done', type: 'textarea' }
        ]},
        { title: 'Before we left', fields: [
          { id: 'checks', type: 'multi', label: 'Checked', options: [
            'Tested, no leaks', 'Water and gas back on', 'Work area cleaned up',
            'Old parts hauled off', 'Walked the customer through the work'],
            byPack: { hvac: ['System starts and runs', 'Heating and cooling tested', 'Thermostat set and shown', 'Filter in, size noted',
              'Drain line flowing', 'Work area cleaned up', 'Walked the customer through the repair'] } }
        ]},
        { title: 'Notes and photos', fields: [
          { id: 'notes', label: 'Notes', type: 'textarea' },
          { id: 'photos', label: 'Photos', type: 'photos', max: 4 }
        ]},
        { title: 'Customer OK', fields: [
          { id: 'happy', label: 'Happy with the work?', type: 'choice', options: ['Yes', 'Not yet, see notes'] }
        ]}
      ]
    },


    {
      id: 'receipt', pack: 'all', icon: 'receipt',
      title: 'Receipt', short: 'Receipt',
      blurb: 'What they paid and for what.',
      sections: [
        { title: 'Payment', fields: [
          { id: 'receipt_no', label: 'Receipt #', type: 'text', half: true, auto: 'receipt' },
          { id: 'paid_for', label: 'Paid for', type: 'textarea' },
          { id: 'amount', label: 'Amount', type: 'money', half: true },
          { id: 'pay_method', label: 'Paid by', type: 'choice', options: ['Cash', 'Check', 'Card', 'Other'] }
        ]}
      ]
    },

    {
      id: 'warranty', pack: 'plumbing', packs: ['plumbing', 'solar', 'hvac'], icon: 'shield',
      title: 'Warranty Card', short: 'Warranty',
      blurb: "What's covered and for how long.",
      sections: [
        { title: "What we're covering", fields: [
          { id: 'work_covered', label: 'Work covered', type: 'textarea' },
          { id: 'equip', label: 'Equipment brand and model', type: 'text' },
          { id: 'serial', label: 'Serial #', type: 'text', half: true },
          { id: 'finish_date', label: 'Work finished on', type: 'date', half: true }
        ]},
        { title: 'How long', fields: [
          { id: 'labor_years', label: 'Labor warranty', type: 'text', half: true, placeholder: 'like 1 year' },
          { id: 'parts_years', label: 'Parts warranty', type: 'text', half: true, placeholder: 'like 6 years' }
        ]},
        { title: 'Good to know', fields: [
          { id: 'warranty_note', type: 'note', text: "Not covered: damage from freezing, flooding, or work by someone else. Something wrong? Call or text us and have this card handy." }
        ]}
      ]
    },

    /* v2.4.0: the yearly whole-house check. Works for any plumbing shop (no shop names here). Water quality and the
       annual plan are optional sections (a switch on the form). Fixture rows are a repeatable group: add or remove rows.
       Anything marked needs work rolls up into the summary; after sending, one tap makes an Estimate from the fixes. */
    {
      /* id stays 'inspection' (was the Plumbing Inspection Report) so saved wording, hidden switches and sent forms carry over */
      id: 'inspection', pack: 'plumbing', icon: 'search', toEstimate: 'recs', offerForm: 'wh-agreement',
      title: 'Annual Plumbing Inspection', short: 'Yearly inspection',
      blurb: 'Pressure, water check, every fixture and valve.',
      sections: [
        { id: 'home', title: 'Home info', fields: [
          { id: 'year_built', label: 'Year built (if known)', type: 'number', half: true },
          { id: 'water_source', label: 'Water comes from', type: 'choice', options: ['City water', 'Well'] },
          { id: 'main_shutoff', label: 'Main shutoff is at', type: 'text', placeholder: 'like front yard by the sidewalk' }
        ]},
        { id: 'pressure', title: 'Water pressure', fields: [
          { id: 'psi', label: 'Static pressure', type: 'number', unit: 'PSI', half: true, sets: 'psi_result',
            range: { lo: 40, hi: 80, ok: 'Good range (40 to 80 PSI).', high: 'Over 80 PSI. Suggest a pressure regulator.', low: 'Under 40 PSI. Low pressure, note it.' } },
          { id: 'psi_result', label: 'Pressure', type: 'passfail' },
          { id: 'prv', label: 'Pressure regulator on the house', type: 'yesno' },
          { id: 'psi_photo', label: 'Photo of the gauge', type: 'photos', max: 1 },
          { id: 'psi_note', type: 'note', text: 'Good range is 40 to 80 PSI. Over 80, suggest a pressure regulator. Under 40, note the low pressure.' }
        ]},
        { id: 'quality', title: 'Water quality', optional: true, toggle: 'Do a quick water check', fields: [
          { id: 'wq_hard', label: 'Hardness', type: 'number', unit: 'gpg', half: true },
          { id: 'wq_cl', label: 'Chlorine', type: 'number', unit: 'ppm', half: true },
          { id: 'wq_ph', label: 'pH', type: 'number', unit: 'pH', half: true },
          { id: 'wq_tds', label: 'TDS', type: 'number', unit: 'ppm', half: true },
          { id: 'wq_method', label: 'How we tested', type: 'choice', options: ['Test strips', 'Meter', 'Lab'] },
          { id: 'wq_notes', label: 'Notes', type: 'textarea' },
          { id: 'wq_note', type: 'note', text: 'Quick check, not a lab test. This is not a health or safety certification. For drinking water safety, use a certified lab.' }
        ]},
        { id: 'fixtures', title: 'Fixtures and valves', fields: [
          { id: 'fixtures', label: 'Room or fixture', type: 'group', addLabel: '+ Add a room or fixture',
            presets: ['Kitchen sink and faucet', 'Bathroom 1 sink and faucet', 'Toilets', 'Tubs and showers', 'Laundry', 'Water heater', 'Main shutoff',
              'Drains', 'Outdoor hose bibs', 'Sewer cleanout', 'Gas line', 'Visible leaks'],
            fields: [
              { id: 'valves', label: 'Shutoff valves work (under sink, behind toilet)', short: 'Shutoff valves work', type: 'yesno', bad: ['No'] },
              { id: 'leak', label: 'Leaks', type: 'choice', options: ['None', 'Minor', 'Active'], bad: ['Minor', 'Active'] },
              { id: 'cond', label: 'Condition', type: 'choice', options: ['Good', 'Fair', 'Needs work'], bad: ['Needs work'] },
              { id: 'note', label: 'Note', type: 'text' },
              { id: 'photo', label: 'Photo', type: 'photos', max: 1 }
            ] }
        ]},
        { id: 'wh', title: 'Water heater quick look', fields: [
          { id: 'wh_age', label: 'Age', type: 'number', unit: 'years', half: true },
          { id: 'wh_tpr', label: 'Relief valve (TPR)', type: 'passfail' },
          { id: 'wh_leak', label: 'Signs of leaks', type: 'choice', options: ['None', 'Minor', 'Active'], bad: ['Minor', 'Active'] },
          { id: 'wh_note', label: 'Note', type: 'text' },
          { id: 'wh_link', type: 'link', form: 'wh-agreement', text: 'After you send this, you can start the Water heater plan for them in one tap.' }
        ]},
        { id: 'summary', title: 'Summary', fields: [
          { id: 'needs', label: 'Needs work', type: 'needswork', fillTo: 'recs' },
          { id: 'recs', label: 'Recommended fixes', type: 'textarea' },
          { id: 'next_date', label: 'Next inspection', type: 'date', auto: 'year', remind: 'Annual inspection due' }
        ]},
        { id: 'plan', title: 'Annual inspection plan', optional: true, toggle: 'Offer the yearly plan', prices: true, fields: [
          { id: 'ai_plan', type: 'pricegrid', label: 'Plan', cols: [{ id: 'year', label: 'Per year' }], unit: '/ year',
            rows: [{ id: 'basic', label: 'BASIC', sub: '1 inspection a year' }, { id: 'plus', label: 'PLUS', sub: '2 inspections a year' }],
            note: 'Prices are per home.' },
          { id: 'ai_want', label: 'Want the plan?', type: 'choice', options: ['Yes, sign me up', 'Not now'] }
        ]}
      ]
    },

    /* ===== HVAC pack (Bee's Service and AC). Bee's has no C-20 license: service and repair under $1,000 only,
       no installs or replacements. Offers, the club name and the cap all come from window.BEES at the top. ===== */
    {
      id: 'hvac-tuneup', pack: 'hvac', icon: 'snow',
      title: 'AC and Heating Tune-Up', short: 'Tune-up',
      blurb: 'The ' + BEES.safetyName + ' or a tune-up. Rate every part, log the readings.',
      sections: [
        { title: 'The visit', fields: [
          { id: 'visit', label: 'Visit', type: 'choice', options: [BEES.safetyName + ' ($' + BEES.safety + ')', 'No-heat diagnostic ($' + BEES.diag + ', waived with a same-day repair)', BEES.club + ' tune-up ($0)', 'Tune-up'] }
        ]},
        { title: 'The system', fields: [
          { id: 'sys_type', label: 'System', type: 'choice', options: ['AC and furnace', 'Heat pump', 'Package unit', 'Mini split'] },
          { id: 'equip', label: 'Brand and model', type: 'text' },
          { id: 'serial', label: 'Serial #', type: 'text', half: true },
          { id: 'filter', label: 'Filter size', type: 'text', half: true, placeholder: 'like 16x25x1' }
        ]},
        { title: 'What we checked', fields: [
          { id: 'inspect', type: 'inspect', label: 'Checked', items: [
            'Thermostat', 'Air filter', 'Outdoor coil', 'Indoor coil', 'Refrigerant levels', 'Capacitor', 'Contactor',
            'Blower motor', 'Condensate drain', 'Electrical connections', 'Burners and flame sensor', 'Heat exchanger', 'Venting', 'Ductwork'] }
        ]},
        { title: 'Readings', fields: [
          { id: 'supply_temp', label: 'Supply air temp', type: 'number', half: true },
          { id: 'return_temp', label: 'Return air temp', type: 'number', half: true },
          { id: 'amps', label: 'Compressor amps', type: 'text', half: true },
          { id: 'pressures', label: 'Pressures', type: 'text', half: true, placeholder: 'suction / head' }
        ]},
        { title: 'What we recommend', fields: [
          { id: 'recs', label: 'Recommendations', type: 'textarea' },
          { id: 'photos', label: 'Photos', type: 'photos', max: 4 }
        ]}
      ]
    },

    {
      /* id kept as hvac-quote so saved drafts and wording changes carry over */
      id: 'hvac-quote', pack: 'hvac', icon: 'fan', cap: BEES.cap,
      title: 'Repair Quote', short: 'Repair quote',
      blurb: 'Service and repair under $' + BEES.cap.toLocaleString('en-US') + '. Give options. They sign to OK one.',
      sections: [
        { title: 'What we found', fields: [
          { id: 'old_sys', label: 'System', type: 'text', placeholder: 'like Carrier gas furnace, about 12 years' },
          { id: 'problem', label: 'What we found', type: 'textarea' }
        ]},
        { title: 'Your options', prices: true, fields: [
          { id: 'options', type: 'options', label: 'Options', names: ['Good', 'Better', 'Best'] },
          { id: 'valid_days', label: 'Price good for (days)', type: 'number', half: true }
        ]},
        { title: 'Every repair includes', fields: [
          { id: 'included', type: 'static', items: [
            'No-heat diagnostic $' + BEES.diag + ', waived when you OK the repair today', 'Test the whole system after the fix',
            'Before and after photos', BEES.club + ' members: $0 diagnostic and ' + BEES.memberOff + '% off'] }
        ]},
        { title: 'Good to know', fields: [
          { id: 'cap_note', type: 'note', text: 'Service and repair only, under $' + BEES.cap.toLocaleString('en-US') + ' total. If it needs a new system or runs $' + BEES.cap.toLocaleString('en-US') + ' or more, we refer you to a licensed installer.' }
        ]},
        { title: 'Your pick', fields: [
          { id: 'picked', label: 'Option picked', type: 'choice', options: ['Good', 'Better', 'Best', 'Not yet'] },
          { id: 'deposit', label: 'Deposit today', type: 'money', half: true }
        ]}
      ]
    },

    {
      /* the membership. Matches /workspace/bees-club (one tier, monthly or yearly). Name: BEES.club */
      id: 'hvac-plan', pack: 'hvac', icon: 'plan',
      title: BEES.club + ' Membership', short: BEES.club,
      blurb: '$' + BEES.monthly + ' a month or $' + BEES.yearly + ' a year. 2 tune-ups, $0 diagnostic, ' + BEES.memberOff + '% off repairs.',
      sections: [
        { title: 'Your plan', fields: [
          { id: 'club_plan', label: 'Plan', type: 'choice', options: BEES.plans },
          { id: 'sys_count', label: 'Systems covered', type: 'number', half: true },
          { id: 'renew', label: 'Renews on', type: 'date', half: true },
          { id: 'extra_note', type: 'note', text: 'One system per membership. Each extra system: +$' + BEES.extraMonthly + ' a month or +$' + BEES.extraYearly + ' a year.' }
        ]},
        { title: 'What members get', fields: [
          { id: 'included', type: 'static', items: [
            '2 tune-ups a year: spring AC check and fall ' + BEES.safetyName,
            '$0 no-heat or no-cool diagnostic (normally $' + BEES.diag + ')',
            BEES.memberOff + '% off repairs (repair must be under $' + BEES.cap.toLocaleString('en-US') + ' before the discount)',
            'Priority scheduling: front of the line when there is an opening',
            'Filter reminder texts if you say yes below', 'Before and after photos every visit'] }
        ]},
        { title: 'Not included', fields: [
          { id: 'not_incl', type: 'note', text: 'Parts, refrigerant, filters, new equipment, anything $' + BEES.cap.toLocaleString('en-US') + ' or more, or anything that needs a permit. Monthly plan: the first included tune-up opens after 3 payments. Cancel anytime.' }
        ]},
        { title: 'How you pay', fields: [
          { id: 'pay_method', label: 'Payment', type: 'choice', options: ['Square link (auto-renew)', 'Paid today, no auto-renew'] },
          { id: 'auto_ok', label: 'Auto-renew OK?', type: 'choice', options: ['Yes', 'No'] },
          { id: 'sms_ok', label: 'Reminder texts OK?', type: 'choice', options: ['Yes', 'No'] }
        ]}
      ]
    },

    {
      id: 'hvac-warranty', pack: 'hvac', icon: 'shield',
      title: 'Repair Warranty Card', short: 'Warranty',
      blurb: "What's covered on our repair and for how long.",
      sections: [
        { title: "What we're covering", fields: [
          { id: 'work_covered', label: 'Repair covered', type: 'textarea' },
          { id: 'equip', label: 'Equipment brand and model', type: 'text' },
          { id: 'serial', label: 'Serial #', type: 'text', half: true },
          { id: 'finish_date', label: 'Repaired on', type: 'date', half: true }
        ]},
        { title: 'How long', fields: [
          { id: 'labor_years', label: 'Labor warranty', type: 'text', half: true, placeholder: 'like 90 days' },
          { id: 'parts_years', label: 'Parts warranty', type: 'text', half: true, placeholder: 'like 1 year' }
        ]},
        { title: 'Good to know', fields: [
          { id: 'warranty_note', type: 'note', text: "Covers the repair we did, not the whole system. Parts carry the maker's warranty. Not covered: damage from storms, power surges, or work by someone else. Something wrong? Call or text us and have this card handy." }
        ]}
      ]
    }
  ]
};

/* Tutorials fallback (the app reads tutorials.json first). Built from src/tutorials.json. */
window.APP_CONFIG.tutorials = [{"id": "full", "group": "start", "full": true, "title": "Full walkthrough", "desc": "Everything in one video, from setup to a signed job.", "length": "12 min", "url": ""}, {"id": "install", "group": "start", "title": "Put the app on your Home Screen", "desc": "Add it to your iPhone so it opens like an app.", "length": "1 min", "url": ""}, {"id": "setup", "group": "start", "title": "Pick your trades and business", "desc": "Turn on solar, plumbing, HVAC or a mix and name each business.", "length": "2 min", "url": ""}, {"id": "backup", "group": "start", "title": "Back up your data", "desc": "Keep a copy of your leads in a Google Sheet.", "length": "2 min", "url": ""}, {"id": "look", "group": "start", "title": "Make it yours", "desc": "Your logo, colors and profile for each business.", "length": "2 min", "url": ""}, {"id": "ec", "group": "solar", "trade": "solar", "title": "Run an Energy Check", "desc": "Walk a homeowner through the check and save the lead.", "length": "3 min", "url": ""}, {"id": "solar-share", "group": "solar", "trade": "solar", "title": "Share your Energy Check link", "desc": "Send your own link so homeowners can fill it out.", "length": "1 min", "url": ""}, {"id": "solar-sheet", "group": "solar", "trade": "solar", "title": "Use your own Google Sheet", "desc": "Hook up your own Sheet, step by step.", "length": "4 min", "url": ""}, {"id": "pl-forms", "group": "plumbing", "trade": "plumbing", "title": "Fill and sign a form", "desc": "Service agreements and work orders, signed on the phone.", "length": "3 min", "url": ""}, {"id": "pl-estimate", "group": "plumbing", "trade": "plumbing", "title": "Send an estimate or invoice", "desc": "Build one, get it signed, and send the PDF.", "length": "3 min", "url": ""}, {"id": "pl-team", "group": "plumbing", "trade": "plumbing", "title": "Add your techs", "desc": "Send a setup link so a tech's phone joins your shop.", "length": "2 min", "url": ""}, {"id": "leads", "group": "everyday", "title": "Add and work a lead", "desc": "Add a lead in seconds, text them and set the next step.", "length": "2 min", "url": ""}, {"id": "pipeline", "group": "everyday", "title": "Use the pipeline", "desc": "Move leads along and see what needs you today.", "length": "2 min", "url": ""}, {"id": "calendar", "group": "everyday", "title": "Calendar and jobs", "desc": "Book installs, repairs and visits, and link your calendars.", "length": "3 min", "url": ""}, {"id": "tabs", "group": "everyday", "title": "Switch between trades", "desc": "The All, Solar and Plumbing tabs and what each shows.", "length": "1 min", "url": ""}, {"id": "hvac-tuneup", "group": "hvac", "trade": "hvac", "title": "Do a safety check or tune-up", "desc": "The $79 Furnace Safety Check or a tune-up: check the system, log the readings and send the report with photos.", "length": "2 min", "url": ""}, {"id": "hvac-quote", "group": "hvac", "trade": "hvac", "title": "Quote a repair", "desc": "Repair options under $1,000, the pick and the deposit on one page. Over $1,000, refer it out.", "length": "3 min", "url": ""}, {"id": "hvac-plan", "group": "hvac", "trade": "hvac", "title": "Sign up a member", "desc": "Monthly or yearly membership, picked and signed on the spot.", "length": "1 min", "url": ""}, {"id": "acct-make", "group": "account", "title": "Make an account", "desc": "Keep your leads safe and use the app on more than one phone.", "length": "1 min", "url": ""}, {"id": "acct-phone", "group": "account", "title": "Sign in on a new phone", "desc": "Your business and leads show up after you sign in.", "length": "1 min", "url": ""}, {"id": "acct-team", "group": "account", "title": "Invite a teammate", "desc": "Send a code so a rep works the same leads.", "length": "1 min", "url": ""}];
