require 'xcodeproj'
require 'fileutils'
root = File.expand_path(ARGV.fetch(0))
raise 'Fresh private work directory required' unless File.directory?(root)
project_path = File.join(root, 'FootNationCapture.xcodeproj')
raise 'Project exists' if File.exist?(project_path)
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:ui_test_bundle, 'FootNationCaptureUITests', :ios, '17.0', nil, :swift)
source = project.main_group.new_file('FootNationCaptureTests.swift')
target.add_file_references([source])
resource = project.main_group.new_file('private-demo.json')
target.resources_build_phase.add_file_reference(resource)
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.footnation.captureUITests',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'IPHONEOS_DEPLOYMENT_TARGET' => '17.0',
    'TARGETED_DEVICE_FAMILY' => '1,2',
    'SUPPORTED_PLATFORMS' => 'iphonesimulator',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'CODE_SIGNING_REQUIRED' => 'NO',
    'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks'],
    'ENABLE_TESTABILITY' => 'YES',
    'SWIFT_OPTIMIZATION_LEVEL' => '-Onone'
  })
  # Deliberately standalone: there is no application target to rebuild.
  %w[TEST_TARGET_NAME TEST_HOST BUNDLE_LOADER].each { |key| configuration.build_settings.delete(key) }
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Debug'
scheme.test_action.should_use_launch_scheme_args_env = false
scheme.save_as(project_path, 'FootNationCapture')
raise 'Unexpected application dependency' unless project.targets.length == 1 && target.dependencies.empty?
