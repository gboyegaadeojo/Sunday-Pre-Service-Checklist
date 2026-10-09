-- Seed: IFC Pre-Service Checklist (requirements.md Section 6, US-14).
-- Generated from requirements.md v1.7. Section numbers come from sort_order, so they are not stored in names.

INSERT INTO task_lists (id, name, description, is_default) VALUES
  (1, 'IFC Pre-Service Checklist', 'Default checklist for regular Sunday services.', 1);


-- Presentation / Computer Graphics
INSERT INTO categories (id, list_id, name, sort_order) VALUES (1, 1, 'Presentation / Computer Graphics', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (1, 1, 'Power & Initial System Check', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (1, 1, 'Verify all server rack devices are powered on, including the Mac and supporting hardware', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (2, 1, 'Wake up the Presentation Station Mac using the mouse or keyboard', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (2, 1, 'Launch Required Software', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (3, 2, 'Open ProPresenter', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (4, 2, 'Open the music software (Tidal, Spotify, or YouTube) — confirm it is copyright-free', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (5, 2, 'Close unnecessary apps and enable Do Not Disturb so no notifications appear on screen', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (3, 1, 'Prepare Worship Lyrics (Highest Priority)', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (6, 3, 'Check the media email (media@ifcwpg.com) for song lists', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (7, 3, 'Import all lyrics into ProPresenter', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (8, 3, 'Format lyrics: maximum two lines per slide, break slides based on how the song is sung', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (9, 3, 'Review each song a second time for accuracy, spelling, formatting, and pacing', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (10, 3, 'Confirm song order and arrangement (repeats, bridges, tags) with the worship leader', 5);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (4, 1, 'Prepare Scriptures & Sermon Notes', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (11, 4, 'Check the media email for Bible verses, sermon notes, and pastor requests', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (12, 4, 'Format and load all content into ProPresenter using correct themes and layouts', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (13, 4, 'Verify all macros function properly', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (14, 4, 'Confirm which Bible translation the pastor is preaching from', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (5, 1, 'Check Announcements', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (15, 5, 'Confirm whether announcements are live or video', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (16, 5, 'If video announcements are required, confirm we have the file; contact the announcement team if missing', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (17, 5, 'Import any requested images or videos from pastors and choir', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (18, 5, 'Ensure all images are horizontal', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (6, 1, 'Check Order of Service & WhatsApp Requests', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (19, 6, 'Review the Order of Service sent on the Media Team WhatsApp group', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (20, 6, 'Save it to the computer and understand the flow', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (21, 6, 'Review WhatsApp messages for special instructions or cues', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (22, 6, 'Share any changes to the order of service with the Director and Audio Engineer', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (7, 1, 'Copyright & Quality Check', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (23, 7, 'Check the Copyrights folder in the media email', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (24, 7, 'Do NOT use videos unless confirmed copyright-safe, licensed, or approved', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (25, 7, 'If anything is unclear or missing, notify the media team immediately', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (26, 7, 'Confirm song credits and license number show on lyric slides if required', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (8, 1, 'Final Pre-Service Checks', 8);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (27, 8, 'Recheck all media emails to ensure nothing was missed', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (28, 8, 'Confirm readiness of lyrics, sermon notes, verses, videos, images, and announcements', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (29, 8, 'Verify the correct ProPresenter theme is applied', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (30, 8, 'Have a blank or logo slide ready to switch to if something goes wrong', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (9, 1, 'Service Start Procedures', 9);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (31, 9, '9:55 AM — Start livestream and coordinate with streaming personnel', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (32, 9, 'Begin looping introduction images', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (33, 9, 'Start non-copyright background music', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (34, 9, '10:04 AM — Play the 1-minute online welcome video', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (10, 1, 'During Service', 10);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (35, 10, 'Stay calm and focused', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (36, 10, 'Follow the service flow smoothly', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (37, 10, 'Keep ProPresenter cues ready and respond quickly', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (11, 1, 'After Service', 11);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (38, 11, 'Clear the stage display', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (39, 11, 'Shut down or sleep the Mac as agreed', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (12, 1, 'Key Reminders', 12);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (40, 12, 'Audio MUST be tested', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (41, 12, 'Videos MUST be tested', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (42, 12, 'Images MUST be horizontal', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (43, 12, 'Lyrics MUST be clean and properly formatted', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (44, 12, 'Emails MUST be checked fully', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (45, 12, 'No copyrighted media unless explicitly approved', 6);

-- Audio Engineer
INSERT INTO categories (id, list_id, name, sort_order) VALUES (2, 1, 'Audio Engineer', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (13, 2, 'Power On', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (46, 13, 'Power on the console and stage boxes first, then amplifiers and powered speakers last', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (47, 13, 'Load the correct scene or show file for this service', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (14, 2, 'Microphones & Batteries', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (48, 14, 'Put fresh batteries in all wireless mics and bodypacks; keep spares at the desk', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (49, 14, 'Line-check every input on stage', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (50, 14, 'Test the pastor''s mic and confirm it is handed off before service', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (15, 2, 'Soundcheck & Monitors', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (51, 15, 'Soundcheck with the worship team and confirm monitor and in-ear mixes', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (52, 15, 'Check for feedback at service volume', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (16, 2, 'Verify Audio Functionality', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (53, 16, 'Test computer audio with the Presentation / Computer Graphics operator', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (54, 16, 'Ensure Tidal/Spotify playback is clear', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (55, 16, 'Check video playback audio levels from ProPresenter', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (17, 2, 'Livestream & Recording', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (56, 17, 'Confirm the livestream mix is reaching the stream at the right level', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (57, 17, 'Start the audio recording before service begins', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (18, 2, 'Communication', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (58, 18, 'Test headsets or intercom with the Director', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (19, 2, 'During Service', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (59, 19, 'Mute mics that are not in use', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (60, 19, 'Follow the order of service for mic and music cues', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (20, 2, 'After Service', 8);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (61, 20, 'Power down amplifiers and powered speakers first, then the console', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (62, 20, 'Return all microphones', 2);

-- Camera Operators
INSERT INTO categories (id, list_id, name, sort_order) VALUES (3, 1, 'Camera Operators', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (21, 3, 'Camera Setup', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (63, 21, 'Power on cameras and check batteries or power supply', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (64, 21, 'Clean the lenses', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (65, 21, 'Level the tripod; check that pan and tilt move smoothly and lock', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (22, 3, 'Picture Check', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (66, 22, 'Set white balance and exposure so all cameras match (with the Director)', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (67, 22, 'Set focus and test the full zoom range', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (23, 3, 'Shots & Order of Service', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (68, 23, 'Review the order of service and your shot assignments', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (69, 23, 'Practice key shots: pulpit, worship leader, choir, and wide shot', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (24, 3, 'Communication', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (70, 24, 'Put on your headset and test intercom with the Director', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (71, 24, 'Confirm your tally light works', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (25, 3, 'Video & Visual Testing (with the Director)', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (72, 25, 'Play through all videos to confirm correct display, audio, and smooth playback', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (73, 25, 'Check all image slides for proper formatting and orientation', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (26, 3, 'During Service', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (74, 26, 'Hold a steady shot while live; reframe only after the Director cuts away', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (75, 26, 'Follow church guidelines on filming the congregation, especially children', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (27, 3, 'After Service', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (76, 27, 'Power down cameras', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (77, 27, 'Put camera batteries on charge', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (78, 27, 'Cap the lenses', 3);

-- Director (Switcher)
INSERT INTO categories (id, list_id, name, sort_order) VALUES (4, 1, 'Director (Switcher)', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (28, 4, 'Power & Systems', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (79, 28, 'Power on the switcher, multiview monitor, and streaming encoder', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (29, 4, 'Inputs', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (80, 29, 'Confirm every camera appears on the multiview', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (81, 29, 'Confirm ProPresenter graphics and lower thirds reach the switcher and key correctly', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (82, 29, 'Confirm audio from the Audio Engineer is present and in sync with video', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (30, 4, 'Video & Visual Testing (with Camera Operators)', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (83, 30, 'Play through all videos to confirm correct display, audio, and smooth playback', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (84, 30, 'Check all image slides for proper formatting and orientation', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (85, 30, 'Match camera color and exposure with the Camera Operators', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (31, 4, 'Livestream', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (86, 31, 'Check the internet connection', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (87, 31, 'Confirm the stream title, thumbnail, and destination are correct', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (88, 31, 'Coordinate the 9:55 AM stream start with the Presentation / Computer Graphics operator', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (89, 31, 'Start a backup recording', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (32, 4, 'Team Briefing', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (90, 32, 'Walk the Camera Operators through the order of service and key moments', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (91, 32, 'Confirm intercom with every operator', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (33, 4, 'During Service', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (92, 33, 'Call shots ahead of time ("Ready camera 2. Take 2.")', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (93, 33, 'Watch the stream output for audio or video problems', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (34, 4, 'After Service', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (94, 34, 'End the livestream and confirm it has stopped on the streaming platform', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (95, 34, 'Stop the backup recording and confirm the file saved', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (96, 34, 'Power down the switcher, multiview, and encoder', 3);

-- Miscellaneous
INSERT INTO categories (id, list_id, name, sort_order) VALUES (5, 1, 'Miscellaneous', 5);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (35, 5, 'Verify All Screens', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (97, 35, 'Test the altar-facing screens with a lyric slide or video', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (98, 35, 'Test the main sanctuary screens', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (99, 35, 'Confirm proper ProPresenter output on all displays', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (100, 35, 'Check that the stage display (confidence monitor) shows lyrics and the clock', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (36, 5, 'Room & Equipment', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (101, 36, 'Set stage lighting and house lights to the service preset', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (102, 36, 'Tidy or tape down cables in walkways', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (103, 36, 'Restock spare batteries, adapters, and cables', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (37, 5, 'After Service', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (104, 37, 'Collect all batteries and return them to charging', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (105, 37, 'Turn off all TVs and screens', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (106, 37, 'Power down servers and equipment in the correct order', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (107, 37, 'Tidy the booth and stage cables', 4);

-- Technical Director
INSERT INTO categories (id, list_id, name, sort_order) VALUES (6, 1, 'Technical Director', 6);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (38, 6, 'Before Service', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (108, 38, 'Confirm the order of service with the pastor', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (109, 38, 'Check in with the worship leader and band on any changes', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (110, 38, 'Confirm all departments are staffed', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (111, 38, 'Review the progress dashboard before 9:55 AM and follow up with any department that''s behind', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (39, 6, 'During Service', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (112, 39, 'Be the point of contact for pastors, band, and volunteers', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (113, 39, 'Watch for problems and coordinate fixes', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (40, 6, 'After Service', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (114, 40, 'Confirm all departments have completed their After Service tasks', 1);

